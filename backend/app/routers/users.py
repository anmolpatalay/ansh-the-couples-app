from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.blobs import delete_bytes, load_bytes, save_bytes
from app.database import get_db
from app.deps import get_current_user
from app.geo import cached_geocode
from app.helpers import new_pair_code, oid, serialize_user
from app.schemas import ProfileSetupIn

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return serialize_user(user)


@router.post("/setup")
async def setup_profile(
    body: ProfileSetupIn,
    user=Depends(get_current_user),
):
    db = get_db()
    try:
        lat, lng, tz_name = cached_geocode(body.city.strip(), body.country.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    pair_code = (user.get("pair_code") or new_pair_code()).upper()
    while await db.users.find_one({"pair_code": pair_code, "_id": {"$ne": user["_id"]}}):
        pair_code = new_pair_code()

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "name": body.name.strip(),
                "city": body.city.strip(),
                "country": body.country.strip(),
                "lat": lat,
                "lng": lng,
                "timezone": tz_name,
                "pair_code": pair_code,
                "profile_complete": True,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    updated = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(updated)


@router.post("/me/picture")
async def upload_picture(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 8MB")
    db = get_db()
    if user.get("profile_picture_id"):
        await delete_bytes(user["profile_picture_id"])
    file_id = await save_bytes(data, file.content_type or "image/jpeg")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"profile_picture_id": file_id}})
    return {"ok": True, "has_profile_picture": True}


@router.get("/{user_id}/picture")
async def get_picture(user_id: str):
    db = get_db()
    user = await db.users.find_one({"_id": oid(user_id)})
    if not user or not user.get("profile_picture_id"):
        raise HTTPException(status_code=404, detail="No picture")
    data, content_type = await load_bytes(user["profile_picture_id"])
    if data is None:
        raise HTTPException(status_code=404, detail="No picture")
    return Response(content=data, media_type=content_type)
