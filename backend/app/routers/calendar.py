from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.deps import require_paired
from app.helpers import couple_key, oid

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def _serialize(doc: dict) -> dict:
    event_date = doc["event_date"]
    if isinstance(event_date, datetime):
        event_date = event_date.date()
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "event_date": event_date.isoformat(),
        "emoji": doc.get("emoji") or "💕",
        "note": doc.get("note"),
        "created_by": str(doc["created_by"]),
    }


def upcoming_reminders(events: list[dict], within_days: int = 7) -> list[dict]:
    today = date.today()
    end = today + timedelta(days=within_days)
    reminders = []
    for ev in events:
        d = date.fromisoformat(ev["event_date"])
        if today <= d <= end:
            days = (d - today).days
            if days == 0:
                when = "today"
            elif days == 1:
                when = "tomorrow"
            else:
                when = f"in {days} days"
            reminders.append({**ev, "when": when, "days_away": days})
    reminders.sort(key=lambda x: x["days_away"])
    return reminders


@router.get("")
async def list_events(user=Depends(require_paired)):
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    events = []
    async for doc in db.calendar_events.find({"couple_key": key}):
        events.append(_serialize(doc))
    events.sort(key=lambda e: e["event_date"])
    return {"events": events, "reminders": upcoming_reminders(events)}


@router.post("")
async def create_event(body: dict, user=Depends(require_paired)):
    title = (body.get("title") or "").strip()
    emoji = (body.get("emoji") or "💕").strip()[:8]
    note = (body.get("note") or None)
    raw_date = body.get("event_date")
    if not title or not raw_date:
        raise HTTPException(status_code=400, detail="Title and date are required")
    try:
        event_date = date.fromisoformat(raw_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date") from exc
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    result = await db.calendar_events.insert_one(
        {
            "couple_key": key,
            "title": title,
            "event_date": datetime(event_date.year, event_date.month, event_date.day, tzinfo=timezone.utc),
            "emoji": emoji,
            "note": note,
            "created_by": user["_id"],
            "created_at": datetime.now(timezone.utc),
        }
    )
    doc = await db.calendar_events.find_one({"_id": result.inserted_id})
    return _serialize(doc)


@router.put("/{event_id}")
async def update_event(event_id: str, body: dict, user=Depends(require_paired)):
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    doc = await db.calendar_events.find_one({"_id": oid(event_id), "couple_key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    updates = {}
    if body.get("title"):
        updates["title"] = body["title"].strip()
    if body.get("emoji"):
        updates["emoji"] = body["emoji"].strip()[:8]
    if "note" in body:
        updates["note"] = body.get("note")
    if body.get("event_date"):
        try:
            d = date.fromisoformat(body["event_date"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid date") from exc
        updates["event_date"] = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    if not updates:
        return _serialize(doc)
    await db.calendar_events.update_one({"_id": doc["_id"]}, {"$set": updates})
    doc = await db.calendar_events.find_one({"_id": doc["_id"]})
    return _serialize(doc)


@router.delete("/{event_id}")
async def delete_event(event_id: str, user=Depends(require_paired)):
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    result = await db.calendar_events.delete_one({"_id": oid(event_id), "couple_key": key})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}
