from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.blobs import delete_bytes, load_bytes, save_bytes
from app.database import get_db
from app.deps import require_paired
from app.helpers import couple_key, oid

router = APIRouter(prefix="/api/photos", tags=["photos"])


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "note": doc.get("note") or "",
        "created_by": str(doc["created_by"]),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        "url": f"/api/photos/{doc['_id']}/file",
    }


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
    file_id = await save_bytes(data, file.content_type or "image/jpeg")
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    result = await db.photos.insert_one(
        {
            "couple_key": key,
            "file_id": file_id,
            "note": (note or "").strip(),
            "created_by": user["_id"],
            "created_at": datetime.now(timezone.utc),
        }
    )
    doc = await db.photos.find_one({"_id": result.inserted_id})
    return _serialize(doc)


@router.get("/{photo_id}/file")
async def photo_file(photo_id: str, user=Depends(require_paired)):
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    doc = await db.photos.find_one({"_id": oid(photo_id), "couple_key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Photo not found")
    data, content_type = await load_bytes(doc["file_id"])
    if data is None:
        raise HTTPException(status_code=404, detail="Photo file missing")
    return Response(content=data, media_type=content_type)


@router.delete("/{photo_id}")
async def delete_photo(photo_id: str, user=Depends(require_paired)):
    db = get_db()
    key = couple_key(str(user["_id"]), str(user["partner_id"]))
    doc = await db.photos.find_one({"_id": oid(photo_id), "couple_key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Photo not found")
    await delete_bytes(doc.get("file_id"))
    await db.photos.delete_one({"_id": doc["_id"]})
    return {"ok": True}
