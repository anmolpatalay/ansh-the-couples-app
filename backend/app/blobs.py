from bson.binary import Binary

from app.database import get_db


async def save_bytes(data: bytes, content_type: str = "image/jpeg"):
    db = get_db()
    result = await db.blobs.insert_one({"data": Binary(data), "content_type": content_type})
    return result.inserted_id


async def load_bytes(file_id):
    db = get_db()
    doc = await db.blobs.find_one({"_id": file_id})
    if not doc:
        return None, None
    return bytes(doc["data"]), doc.get("content_type") or "image/jpeg"


async def delete_bytes(file_id) -> None:
    if not file_id:
        return
    db = get_db()
    await db.blobs.delete_one({"_id": file_id})
