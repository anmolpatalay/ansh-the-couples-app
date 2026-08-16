from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.deps import require_paired
from app.geo import geodesic_km, ntp_utc, ntp_utc_ms, timezone_for_coords, zoneinfo_of
from app.helpers import couple_key
from app.routers.calendar import upcoming_reminders, _serialize as serialize_event

router = APIRouter(prefix="/api/home", tags=["home"])


def pin_for(user: dict, utc_now) -> dict:
    if user.get("lat") is None or user.get("lng") is None:
        raise HTTPException(status_code=400, detail="Location is missing; update your profile")
    lat = float(user["lat"])
    lng = float(user["lng"])
    tz_name = user.get("timezone") or timezone_for_coords(lat, lng)
    local = utc_now.astimezone(zoneinfo_of(tz_name))
    stamp = local.strftime("%Y-%m-%d %H:%M:%S")
    abbr = local.tzname() or tz_name
    return {
        "user_id": str(user["_id"]),
        "name": user.get("name") or "Someone",
        "city": user.get("city") or "",
        "country": user.get("country") or "",
        "lat": lat,
        "lng": lng,
        "local_time": f"{stamp} {abbr}",
        "timezone": tz_name,
        "picture_url": f"/api/users/{user['_id']}/picture" if user.get("profile_picture_id") else "",
    }


@router.get("/map")
async def home_map(user=Depends(require_paired)):
    db = get_db()
    partner = await db.users.find_one({"_id": user["partner_id"]})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    utc_now = ntp_utc()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    events = []
    async for doc in db.calendar_events.find({"couple_key": key}):
        events.append(serialize_event(doc))
    pins = [pin_for(user, utc_now), pin_for(partner, utc_now)]
    return {
        "ntp_utc_ms": int(utc_now.timestamp() * 1000),
        "pins": pins,
        "distance_km": geodesic_km(pins[0]["lat"], pins[0]["lng"], pins[1]["lat"], pins[1]["lng"]),
        "reminders": upcoming_reminders(events),
    }


@router.get("/clock")
async def home_clock(_user=Depends(require_paired)):
    return {"ntp_utc_ms": ntp_utc_ms()}
