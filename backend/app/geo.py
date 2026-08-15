from datetime import datetime, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import ntplib
from geopy.geocoders import Nominatim
from timezonefinder import TimezoneFinder

from app.config import settings

try:
    import tzdata  # noqa: F401
except ImportError:
    tzdata = None

_tf = TimezoneFinder()
_geocoder = Nominatim(user_agent="ansh-couples-app", timeout=10)

TZ_ALIASES = {
    "Asia/Calcutta": "Asia/Kolkata",
    "US/Eastern": "America/New_York",
    "US/Central": "America/Chicago",
    "US/Mountain": "America/Denver",
    "US/Pacific": "America/Los_Angeles",
    "US/Alaska": "America/Anchorage",
    "US/Hawaii": "Pacific/Honolulu",
    "Etc/UTC": "UTC",
    "UTC": "UTC",
}


def zoneinfo_of(tz_name: str) -> ZoneInfo:
    key = TZ_ALIASES.get((tz_name or "").strip() or "UTC", (tz_name or "UTC").strip())
    try:
        return ZoneInfo(key)
    except ZoneInfoNotFoundError:
        if tzdata is None:
            print("Install tzdata for local times: python -m pip install tzdata")
        return ZoneInfo("UTC")


def timezone_for_coords(lat: float, lng: float) -> str:
    name = (
        _tf.certain_timezone_at(lat=lat, lng=lng)
        or _tf.timezone_at(lat=lat, lng=lng)
        or "UTC"
    )
    resolved = TZ_ALIASES.get(name, name)
    zoneinfo_of(resolved)
    return resolved


def geocode_place(city: str, country: str) -> tuple[float, float, str]:
    city = " ".join((city or "").split())
    country = " ".join((country or "").split())
    query = f"{city}, {country}".strip(", ")
    location = _geocoder.geocode(query, addressdetails=False, language="en")
    if not location and city:
        location = _geocoder.geocode(city, language="en")
    if not location:
        location = _geocoder.geocode(country, language="en")
    if not location:
        raise ValueError(f"Could not find coordinates for {query}")
    lat = float(location.latitude)
    lng = float(location.longitude)
    return lat, lng, timezone_for_coords(lat, lng)


def ntp_utc() -> datetime:
    client = ntplib.NTPClient()
    try:
        response = client.request(settings.ntp_host, version=3, timeout=4)
        return datetime.fromtimestamp(response.tx_time, tz=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def local_time_iso(tz_name: str, lat: float | None = None, lng: float | None = None) -> tuple[str, str]:
    if lat is not None and lng is not None:
        tz_name = timezone_for_coords(lat, lng)
    utc_now = ntp_utc()
    local = utc_now.astimezone(zoneinfo_of(tz_name))
    stamp = local.strftime("%Y-%m-%d %H:%M:%S")
    abbr = local.tzname() or tz_name
    return f"{stamp} {abbr}", tz_name


@lru_cache(maxsize=256)
def cached_geocode(city: str, country: str) -> tuple[float, float, str]:
    return geocode_place(city, country)
