from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.auth import decode_token
from app.database import get_db
from app.helpers import oid

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user_id = decode_token(creds.credentials, "access")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token")
    db = get_db()
    user = await db.users.find_one({"_id": oid(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def require_profile(user=Depends(get_current_user)):
    if not user.get("profile_complete"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Complete your profile first")
    return user


async def require_paired(user=Depends(require_profile)):
    if not user.get("partner_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pair with your partner first")
    return user


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
