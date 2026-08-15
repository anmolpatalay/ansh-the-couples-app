from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.deps import require_paired
from app.geo import local_time_iso
from app.helpers import couple_key
from app.routers.calendar import upcoming_reminders, _serialize as serialize_event

router = APIRouter(prefix="/api/home", tags=["home"])


def pin_for(user: dict) -> dict:
    if user.get("lat") is None or user.get("lng") is None:
        raise HTTPException(status_code=400, detail="Location is missing; update your profile")
    local_time, tz_name = local_time_iso(
        user.get("timezone") or "UTC",
        lat=float(user["lat"]),
        lng=float(user["lng"]),
    )
    return {
        "user_id": str(user["_id"]),
        "name": user.get("name") or "Someone",
        "city": user.get("city") or "",
        "country": user.get("country") or "",
        "lat": float(user["lat"]),
        "lng": float(user["lng"]),
        "local_time": local_time,
        "timezone": tz_name,
        "picture_url": f"/api/users/{user['_id']}/picture" if user.get("profile_picture_id") else "",
    }


@router.get("/map")
async def home_map(user=Depends(require_paired)):
    db = get_db()
    partner = await db.users.find_one({"_id": user["partner_id"]})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    events = []
    async for doc in db.calendar_events.find({"couple_key": key}):
        events.append(serialize_event(doc))
    return {
        "pins": [pin_for(user), pin_for(partner)],
        "reminders": upcoming_reminders(events),
    }
