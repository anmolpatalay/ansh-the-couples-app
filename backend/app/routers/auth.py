from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from jose import JWTError

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_hash,
    verify_password,
)
from app.config import settings
from app.database import get_db
from app.helpers import oid
from app.schemas import LoginIn, RefreshIn, SignupIn, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", status_code=201)
async def signup(body: SignupIn):
    db = get_db()
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    result = await db.users.insert_one(
        {
            "email": body.email.lower(),
            "password_hash": hash_password(body.password),
            "profile_complete": False,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"id": str(result.inserted_id), "email": body.email.lower()}


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn):
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    access = create_access_token(str(user["_id"]))
    refresh = create_refresh_token(str(user["_id"]))
    expires = datetime.now(timezone.utc)
    from datetime import timedelta

    expires = expires + timedelta(days=settings.refresh_token_expire_days)
    await db.refresh_tokens.insert_one(
        {
            "user_id": user["_id"],
            "token_hash": token_hash(refresh),
            "expires_at": expires,
        }
    )
    return TokenOut(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn):
    db = get_db()
    try:
        user_id = decode_token(body.refresh_token, "refresh")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    hashed = token_hash(body.refresh_token)
    stored = await db.refresh_tokens.find_one({"token_hash": hashed})
    if not stored:
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    user = await db.users.find_one({"_id": oid(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    await db.refresh_tokens.delete_one({"_id": stored["_id"]})
    access = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    from datetime import timedelta

    await db.refresh_tokens.insert_one(
        {
            "user_id": user["_id"],
            "token_hash": token_hash(refresh_token),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        }
    )
    return TokenOut(access_token=access, refresh_token=refresh_token)


@router.post("/logout")
async def logout(body: RefreshIn):
    db = get_db()
    await db.refresh_tokens.delete_one({"token_hash": token_hash(body.refresh_token)})
    return {"ok": True}


@router.get("/me")
async def me_placeholder():
    return {"hint": "Use /api/users/me with a Bearer access token"}
