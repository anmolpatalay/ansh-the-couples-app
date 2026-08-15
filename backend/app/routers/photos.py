from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import decode_token
from app.blobs import delete_bytes, load_bytes, save_bytes
from app.database import get_db
from app.deps import require_paired
from app.helpers import couple_key, oid
from app.images import compress_full, make_thumb
from jose import JWTError

router = APIRouter(prefix="/api/photos", tags=["photos"])
bearer = HTTPBearer(auto_error=False)


async def paired_from_header_or_query(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    access_token: str | None = Query(default=None),
):
    token = creds.credentials if creds and creds.scheme.lower() == "bearer" else access_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = decode_token(token, "access")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    db = get_db()
    user = await db.users.find_one({"_id": oid(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("profile_complete") or not user.get("partner_id"):
        raise HTTPException(status_code=403, detail="Pair with your partner first")
    return user


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "note": doc.get("note") or "",
        "created_by": str(doc["created_by"]),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        "url": f"/api/photos/{doc['_id']}/file",
        "thumb_url": f"/api/photos/{doc['_id']}/thumb",
    }


def _cached(data: bytes, content_type: str, etag: str) -> Response:
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "private, max-age=604800, immutable",
            "ETag": etag,
        },
    )


@router.get("")
async def list_photos(user=Depends(require_paired)):
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    photos = []
    async for doc in db.photos.find({"couple_key": key}).sort("created_at", -1):
        photos.append(_serialize(doc))
    return {"photos": photos}


@router.post("")
async def add_photo(
    file: UploadFile = File(...),
    note: str = Form(""),
    user=Depends(require_paired),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 8MB")
    try:
        full, full_type = compress_full(data)
        thumb, thumb_type = make_thumb(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read that image") from exc
    file_id = await save_bytes(full, full_type)
    thumb_id = await save_bytes(thumb, thumb_type)
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    result = await db.photos.insert_one(
        {
            "couple_key": key,
            "file_id": file_id,
            "thumb_id": thumb_id,
            "note": (note or "").strip(),
            "created_by": user["_id"],
            "created_at": datetime.now(timezone.utc),
        }
    )
    doc = await db.photos.find_one({"_id": result.inserted_id})
    return _serialize(doc)


@router.get("/{photo_id}/thumb")
async def photo_thumb(photo_id: str, user=Depends(paired_from_header_or_query)):
    return await _send_variant(photo_id, user, thumb=True)


@router.get("/{photo_id}/file")
async def photo_file(photo_id: str, user=Depends(paired_from_header_or_query)):
    return await _send_variant(photo_id, user, thumb=False)


async def _send_variant(photo_id: str, user: dict, thumb: bool) -> Response:
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    doc = await db.photos.find_one({"_id": oid(photo_id), "couple_key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Photo not found")
    blob_id = doc.get("thumb_id") if thumb else doc.get("file_id")
    if thumb and not doc.get("thumb_id") and doc.get("file_id"):
        original, _ = await load_bytes(doc["file_id"])
        if original:
            thumb_bytes, thumb_type = make_thumb(original)
            thumb_id = await save_bytes(thumb_bytes, thumb_type)
            await db.photos.update_one({"_id": doc["_id"]}, {"$set": {"thumb_id": thumb_id}})
            blob_id = thumb_id
    data, content_type = await load_bytes(blob_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Photo file missing")
    return _cached(data, content_type, f'"{blob_id}"')


@router.delete("/{photo_id}")
async def delete_photo(photo_id: str, user=Depends(require_paired)):
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    doc = await db.photos.find_one({"_id": oid(photo_id), "couple_key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Photo not found")
    await delete_bytes(doc.get("file_id"))
    await delete_bytes(doc.get("thumb_id"))
    await db.photos.delete_one({"_id": doc["_id"]})
    return {"ok": True}
