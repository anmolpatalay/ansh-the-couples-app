import secrets
import string
from bson import ObjectId
from bson.errors import InvalidId


def new_pair_code() -> str:
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace("0", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(8))


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise ValueError("Invalid id") from exc


def couple_key(user_id: str, partner_id: str) -> str:
    return ":".join(sorted([user_id, partner_id]))


def serialize_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name"),
        "city": doc.get("city"),
        "country": doc.get("country"),
        "pair_code": doc.get("pair_code"),
        "profile_complete": bool(doc.get("profile_complete")),
        "paired": bool(doc.get("partner_id")),
        "partner_id": str(doc["partner_id"]) if doc.get("partner_id") else None,
        "has_profile_picture": bool(doc.get("profile_picture_id")),
    }
