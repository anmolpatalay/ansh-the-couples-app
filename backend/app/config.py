from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "ansh"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 1
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000"
    ntp_host: str = "pool.ntp.org"
    max_upload_mb: int = 8

    model_config = SettingsConfigDict(
        env_file=(str(ROOT / ".env"), str(BACKEND / ".env")),
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
