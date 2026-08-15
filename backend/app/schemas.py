from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class GoogleTokenIn(BaseModel):
    id_token: str


class ProfileSetupIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(min_length=1, max_length=80)
    country: str = Field(min_length=1, max_length=80)


class PairRequestIn(BaseModel):
    pair_code: str = Field(min_length=4, max_length=16)


class PairDecisionIn(BaseModel):
    request_id: str
    accept: bool


class CalendarEventIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    event_date: date
    emoji: str = Field(default="💕", max_length=8)
    note: Optional[str] = Field(default=None, max_length=400)


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    event_date: Optional[date] = None
    emoji: Optional[str] = Field(default=None, max_length=8)
    note: Optional[str] = Field(default=None, max_length=400)


class PhotoNoteIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class UserPublic(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    pair_code: Optional[str] = None
    profile_complete: bool = False
    paired: bool = False
    partner_id: Optional[str] = None
    has_profile_picture: bool = False


class PartnerPublic(BaseModel):
    id: str
    name: str
    city: str
    country: str
    has_profile_picture: bool = False


class LocationPin(BaseModel):
    user_id: str
    name: str
    city: str
    country: str
    lat: float
    lng: float
    local_time: str
    timezone: str
    picture_url: str


class HomeMapOut(BaseModel):
    pins: list[LocationPin]
    reminders: list[dict]


class PairRequestOut(BaseModel):
    id: str
    from_user_id: str
    from_name: str
    to_user_id: str
    to_name: str
    status: str
    created_at: datetime
    direction: str
