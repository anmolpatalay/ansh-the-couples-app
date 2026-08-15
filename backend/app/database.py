from pymongo import AsyncMongoClient
from pymongo.errors import OperationFailure

from app.config import settings

client: AsyncMongoClient | None = None
db = None


async def connect_db() -> None:
    global client, db
    client = AsyncMongoClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    await client.admin.command("ping")
    try:
        await db.users.create_index("google_id", unique=True, sparse=True)
        await db.users.create_index("pair_code", unique=True, sparse=True)
        await db.refresh_tokens.create_index("token_hash", unique=True)
        await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.pair_requests.create_index([("from_user_id", 1), ("to_user_id", 1), ("status", 1)])
        await db.calendar_events.create_index("couple_key")
        await db.photos.create_index("couple_key")
    except OperationFailure as exc:
        print(f"Atlas user cannot create indexes ({exc.details.get('errmsg', exc)}). App will still start.")


async def close_db() -> None:
    global client
    if client:
        await client.close()


def get_db():
    assert db is not None
    return db
