from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
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
from app.schemas import GoogleTokenIn, LoginIn, RefreshIn, SignupIn, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def issue_tokens(user_id, user_oid) -> TokenOut:
    db = get_db()
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    await db.refresh_tokens.insert_one(
        {
            "user_id": user_oid,
            "token_hash": token_hash(refresh),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        }
    )
    return TokenOut(access_token=access, refresh_token=refresh)


@router.get("/config")
async def auth_config():
    return {"google_client_id": settings.google_client_id or ""}


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
            "auth_provider": "password",
            "profile_complete": False,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"id": str(result.inserted_id), "email": body.email.lower()}


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn):
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google. Continue with Google.",
        )
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return await issue_tokens(str(user["_id"]), user["_id"])


@router.post("/google", response_model=TokenOut)
async def google_login(body: GoogleTokenIn):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    try:
        info = id_token.verify_oauth2_token(
            body.id_token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Google token") from exc
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google token")
    email = (info.get("email") or "").lower()
    google_id = info.get("sub")
    if not email or not google_id:
        raise HTTPException(status_code=401, detail="Google did not return an email")
    db = get_db()
    user = await db.users.find_one({"google_id": google_id}) or await db.users.find_one({"email": email})
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "google_id": google_id,
                    "auth_provider": user.get("auth_provider") or "google",
                }
            },
        )
    else:
        result = await db.users.insert_one(
            {
                "email": email,
                "google_id": google_id,
                "name": (info.get("name") or "").strip() or None,
                "auth_provider": "google",
                "profile_complete": False,
                "created_at": datetime.now(timezone.utc),
            }
        )
        user = await db.users.find_one({"_id": result.inserted_id})
    return await issue_tokens(str(user["_id"]), user["_id"])


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
    return await issue_tokens(user_id, user["_id"])


@router.post("/logout")
async def logout(body: RefreshIn):
    db = get_db()
    await db.refresh_tokens.delete_one({"token_hash": token_hash(body.refresh_token)})
    return {"ok": True}
