from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.deps import require_profile
from app.helpers import oid, serialize_user
from app.schemas import PairDecisionIn, PairRequestIn

router = APIRouter(prefix="/api/pairing", tags=["pairing"])


def _name(user: dict) -> str:
    return user.get("name") or user["email"]


@router.get("/status")
async def pairing_status(user=Depends(require_profile)):
    db = get_db()
    incoming = []
    outgoing = []
    cursor = db.pair_requests.find(
        {
            "status": "pending",
            "$or": [{"from_user_id": user["_id"]}, {"to_user_id": user["_id"]}],
        }
    )
    async for req in cursor:
        other_id = req["to_user_id"] if req["from_user_id"] == user["_id"] else req["from_user_id"]
        other = await db.users.find_one({"_id": other_id})
        item = {
            "id": str(req["_id"]),
            "from_user_id": str(req["from_user_id"]),
            "from_name": req.get("from_name") or "",
            "to_user_id": str(req["to_user_id"]),
            "to_name": req.get("to_name") or "",
            "status": req["status"],
            "created_at": req["created_at"],
            "other_name": _name(other) if other else "Unknown",
            "direction": "outgoing" if req["from_user_id"] == user["_id"] else "incoming",
        }
        if item["direction"] == "incoming":
            incoming.append(item)
        else:
            outgoing.append(item)

    partner = None
    if user.get("partner_id"):
        p = await db.users.find_one({"_id": user["partner_id"]})
        if p:
            partner = serialize_user(p)
            partner.pop("email", None)

    return {
        "me": serialize_user(user),
        "partner": partner,
        "incoming": incoming,
        "outgoing": outgoing,
    }


@router.post("/request")
async def send_request(body: PairRequestIn, user=Depends(require_profile)):
    if user.get("partner_id"):
        raise HTTPException(status_code=400, detail="You are already paired")
    db = get_db()
    code = body.pair_code.strip().upper()
    partner = await db.users.find_one({"pair_code": code})
    if not partner:
        raise HTTPException(status_code=404, detail="No one found with that pair code")
    if partner["_id"] == user["_id"]:
        raise HTTPException(status_code=400, detail="You cannot pair with yourself")
    if partner.get("partner_id"):
        raise HTTPException(status_code=400, detail="That person is already paired")

    existing = await db.pair_requests.find_one(
        {
            "status": "pending",
            "$or": [
                {"from_user_id": user["_id"], "to_user_id": partner["_id"]},
                {"from_user_id": partner["_id"], "to_user_id": user["_id"]},
            ],
        }
    )
    if existing:
        raise HTTPException(status_code=409, detail="A pair request already exists")

    result = await db.pair_requests.insert_one(
        {
            "from_user_id": user["_id"],
            "to_user_id": partner["_id"],
            "from_name": _name(user),
            "to_name": _name(partner),
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"id": str(result.inserted_id), "status": "pending"}


@router.post("/decide")
async def decide(body: PairDecisionIn, user=Depends(require_profile)):
    db = get_db()
    req = await db.pair_requests.find_one({"_id": oid(body.request_id)})
    if not req or req["to_user_id"] != user["_id"]:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    if not body.accept:
        await db.pair_requests.update_one({"_id": req["_id"]}, {"$set": {"status": "rejected"}})
        return {"status": "rejected"}

    if user.get("partner_id"):
        raise HTTPException(status_code=400, detail="You are already paired")
    other = await db.users.find_one({"_id": req["from_user_id"]})
    if not other or other.get("partner_id"):
        raise HTTPException(status_code=400, detail="The other person is no longer available")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"partner_id": other["_id"]}})
    await db.users.update_one({"_id": other["_id"]}, {"$set": {"partner_id": user["_id"]}})
    await db.pair_requests.update_one({"_id": req["_id"]}, {"$set": {"status": "accepted"}})
    await db.pair_requests.update_many(
        {
            "status": "pending",
            "$or": [
                {"from_user_id": user["_id"]},
                {"to_user_id": user["_id"]},
                {"from_user_id": other["_id"]},
                {"to_user_id": other["_id"]},
            ],
        },
        {"$set": {"status": "cancelled"}},
    )
    return {"status": "accepted"}
