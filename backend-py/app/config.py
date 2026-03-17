from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/aisla"
    jwt_secret: str = "change-me-in-production"
    cors_origin: str = "http://localhost:8030"
    port: int = 5030

    # JWT lifetimes
    access_token_expire_days: int = 5
    refresh_token_expire_days: int = 30

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # Azure OpenAI
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_gpt4_1_mini_deployment: str = "gpt-4.1-mini"

    # ── Monitor checks ────────────────────────────────────────────────────────
    check_sos_enabled: bool = True
    check_geofence_enabled: bool = True
    check_inactive_enabled: bool = False
    check_medication_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()