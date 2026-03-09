from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/aisla"
    jwt_secret: str = "change-me-in-production"
    cors_origin: str = "http://localhost:8030"
    port: int = 5030

    # JWT lifetimes
    access_token_expire_days: int = 5
    refresh_token_expire_days: int = 30

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
