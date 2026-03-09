import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.system_config import SystemConfig
from app.models.token import Token

settings = get_settings()

# ─── Token lifetimes ─────────────────────────────────────────────────────────
ACCESS_TOKEN_TTL = timedelta(days=settings.access_token_expire_days)
REFRESH_TOKEN_TTL = timedelta(days=settings.refresh_token_expire_days)

# ─── Module-level secret cache ───────────────────────────────────────────────
_cached_secret: Optional[str] = None


def init_jwt_secret(db: Session) -> None:
    """Load or generate the JWT signing secret from DB."""
    global _cached_secret
    config = db.query(SystemConfig).filter(SystemConfig.key == "jwt_secret").first()
    if not config:
        secret = secrets.token_hex(64)
        config = SystemConfig(key="jwt_secret", value=secret)
        db.add(config)
        db.commit()
        print("✔ Generated and stored new JWT secret in DB")
    _cached_secret = config.value
    print("✔ JWT secret loaded from DB")


def _get_secret() -> str:
    if _cached_secret:
        return _cached_secret
    # Fallback to env variable
    return settings.jwt_secret


def generate_token_pair(
    db: Session,
    user_id: str,
    role: str,
    corporate_id: Optional[str] = None,
) -> dict:
    """Issue fresh access + refresh token pair. Revokes all previous active tokens."""
    # Revoke existing active tokens for this user
    db.query(Token).filter(
        Token.user_id == uuid.UUID(user_id),
        Token.is_revoked == False,
    ).update({"is_revoked": True})

    token_id = str(uuid.uuid4())
    now = datetime.utcnow()

    access_payload = {
        "userId": user_id,
        "role": role,
        "tokenId": token_id,
        "type": "access",
        "exp": now + ACCESS_TOKEN_TTL,
    }
    if corporate_id:
        access_payload["corporate_id"] = corporate_id

    access_token = jwt.encode(access_payload, _get_secret(), algorithm="HS256")

    refresh_payload = {
        "userId": user_id,
        "role": role,
        "tokenId": token_id,
        "type": "refresh",
        "exp": now + REFRESH_TOKEN_TTL,
    }
    if corporate_id:
        refresh_payload["corporate_id"] = corporate_id

    refresh_token = jwt.encode(refresh_payload, _get_secret(), algorithm="HS256")

    db_token = Token(
        id=uuid.UUID(token_id),
        user_id=uuid.UUID(user_id),
        access_token=access_token,
        refresh_token=refresh_token,
        access_token_expires_at=now + ACCESS_TOKEN_TTL,
        refresh_token_expires_at=now + REFRESH_TOKEN_TTL,
    )
    db.add(db_token)
    db.commit()

    return {"accessToken": access_token, "refreshToken": refresh_token}


def verify_access_token(db: Session, token: str) -> dict:
    """Verify access token: JWT signature + DB active record."""
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=["HS256"])
    except JWTError:
        raise ValueError("Invalid or expired access token")

    if payload.get("type") != "access":
        raise ValueError("Token is not an access token")

    record = db.query(Token).filter(Token.id == uuid.UUID(payload["tokenId"])).first()
    if not record or record.is_revoked or record.access_token != token:
        raise ValueError("Token has been revoked")

    return payload


def rotate_tokens(db: Session, refresh_token: str) -> dict:
    """Validate refresh token, revoke it, and issue a new pair."""
    try:
        payload = jwt.decode(refresh_token, _get_secret(), algorithms=["HS256"])
    except JWTError:
        raise ValueError("Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise ValueError("Token is not a refresh token")

    record = db.query(Token).filter(Token.id == uuid.UUID(payload["tokenId"])).first()
    if not record or record.is_revoked or record.refresh_token != refresh_token:
        raise ValueError("Refresh token not found or already revoked")

    record.is_revoked = True
    db.commit()

    return generate_token_pair(
        db,
        payload["userId"],
        payload["role"],
        payload.get("corporate_id"),
    )


def revoke_user_tokens(db: Session, user_id: str, token_id: Optional[str] = None) -> None:
    """Revoke a specific token or all active tokens for a user."""
    if token_id:
        record = db.query(Token).filter(Token.id == uuid.UUID(token_id)).first()
        if record:
            record.is_revoked = True
            db.commit()
    else:
        db.query(Token).filter(
            Token.user_id == uuid.UUID(user_id),
            Token.is_revoked == False,
        ).update({"is_revoked": True})
        db.commit()
