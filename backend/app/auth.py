import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def hash_password(password: str) -> str:
    secret = password.encode("utf-8")[:72]
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    secret = password.encode("utf-8")[:72]
    return bcrypt.checkpw(secret, password_hash.encode("utf-8"))


def create_access_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": sub, "type": "access", "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode(
        {"sub": sub, "type": "refresh", "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str, expected_type: str) -> str:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise JWTError("Wrong token type")
    sub = payload.get("sub")
    if not sub:
        raise JWTError("Missing subject")
    return sub


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
