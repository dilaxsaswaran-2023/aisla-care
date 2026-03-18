import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import get_db
from app.models.user import User
from app.models.token import Token
from app.jwt_utils import generate_token_pair, rotate_tokens, verify_access_token, revoke_user_tokens
from app.auth import get_current_user
from app.services.audit_log_service import log_audit_event, build_field_changes

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── POST /api/auth/signup ───────────────────────────────────────────────────
@router.post("/signup", status_code=201)
def signup(body: dict, db: Session = Depends(get_db)):
    email = body.get("email")
    password = body.get("password")
    full_name = body.get("full_name")
    role = body.get("role", "patient")

    if not email or not password or not full_name:
        raise HTTPException(400, "email, password and full_name are required")
    if role == "super_admin":
        raise HTTPException(403, "Cannot create super_admin via signup")

    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise HTTPException(400, "Email already in use")

    hashed = pwd_context.hash(password)
    user = User(email=email.lower(), password=hashed, full_name=full_name, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)

    tokens = generate_token_pair(db, str(user.id), user.role,
                                 str(user.corporate_id) if user.corporate_id else None)

    log_audit_event(
        db,
        action="auth_signup_completed",
        event_type="auth",
        entity_type="user",
        entity_id=str(user.id),
        user_id=user.id,
        summary="New user signup completed",
        details="A new user account was created via signup.",
        context={
            "email": user.email,
            "role": user.role,
        },
    )

    return {
        **tokens,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "corporate_id": str(user.corporate_id) if user.corporate_id else None,
        },
    }


# ─── POST /api/auth/login ────────────────────────────────────────────────────
@router.post("/login")
def login(body: dict, db: Session = Depends(get_db)):
    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        raise HTTPException(400, "email and password are required")

    user = db.query(User).filter(User.email == email.lower()).first()
    if not user:
        raise HTTPException(401, "Invalid credentials")

    if not pwd_context.verify(password, user.password):
        raise HTTPException(401, "Invalid credentials")

    tokens = generate_token_pair(db, str(user.id), user.role,
                                 str(user.corporate_id) if user.corporate_id else None)

    log_audit_event(
        db,
        action="auth_login_succeeded",
        event_type="auth",
        entity_type="user",
        entity_id=str(user.id),
        user_id=user.id,
        summary="User login succeeded",
        details="User credentials were validated and a token pair was issued.",
        context={
            "email": user.email,
            "role": user.role,
        },
    )

    return {
        **tokens,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "corporate_id": str(user.corporate_id) if user.corporate_id else None,
            "status": user.status,
            "phone_country": user.phone_country,
            "phone_number": user.phone_number,
        },
    }


# ─── POST /api/auth/complete-invite ──────────────────────────────────────────
@router.post("/complete-invite")
def complete_invite(body: dict, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user["userId"]
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.status != "invited":
        raise HTTPException(400, "User is not in invited state")

    new_password = body.get("new_password")
    before = {
        "full_name": user.full_name,
        "status": user.status,
        "phone_country": user.phone_country,
        "phone_number": user.phone_number,
        "address": user.address,
        "password": "***" if user.password else None,
    }

    if new_password:
        user.password = pwd_context.hash(new_password)
    if body.get("full_name"):
        user.full_name = body["full_name"]
    if "phone_country" in body:
        user.phone_country = body["phone_country"]
    if "phone_number" in body:
        user.phone_number = body["phone_number"]
    if "address" in body:
        user.address = body["address"]

    user.status = "active"
    db.commit()
    db.refresh(user)

    tokens = generate_token_pair(db, str(user.id), user.role,
                                 str(user.corporate_id) if user.corporate_id else None)

    after = {
        "full_name": user.full_name,
        "status": user.status,
        "phone_country": user.phone_country,
        "phone_number": user.phone_number,
        "address": user.address,
        "password": "***" if user.password else None,
    }
    changes = build_field_changes(
        before,
        after,
        ["full_name", "status", "phone_country", "phone_number", "address", "password"],
    )

    log_audit_event(
        db,
        action="auth_invite_completed",
        event_type="auth",
        entity_type="user",
        entity_id=str(user.id),
        user_id=user.id,
        summary="Invited user completed account setup",
        details="Invite acceptance finished and account status became active.",
        context={
            "email": user.email,
            "role": user.role,
        },
        changes=changes,
    )

    return {
        **tokens,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "corporate_id": str(user.corporate_id) if user.corporate_id else None,
            "status": user.status,
            "phone_country": user.phone_country,
            "phone_number": user.phone_number,
        },
    }


# ─── POST /api/auth/refresh ──────────────────────────────────────────────────
@router.post("/refresh")
def refresh(body: dict, db: Session = Depends(get_db)):
    refresh_token = body.get("refreshToken")
    if not refresh_token:
        raise HTTPException(400, "refreshToken is required")
    try:
        tokens = rotate_tokens(db, refresh_token)
        log_audit_event(
            db,
            action="auth_token_refreshed",
            event_type="auth",
            entity_type="session",
            summary="Access token refreshed",
            details="Refresh token was exchanged for a new token pair.",
            context={"token_flow": "refresh"},
        )
        return tokens
    except ValueError as e:
        raise HTTPException(401, str(e))


# ─── POST /api/auth/logout ───────────────────────────────────────────────────
@router.post("/logout")
def logout(body: dict = None, db: Session = Depends(get_db),
           authorization: str = None):
    from fastapi import Request
    # Try access token first
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization.split(" ")[1]
        try:
            payload = verify_access_token(db, token_str)
            revoke_user_tokens(db, payload["userId"], payload["tokenId"])
            log_audit_event(
                db,
                action="auth_logout",
                event_type="auth",
                entity_type="session",
                user_id=payload.get("userId"),
                entity_id=str(payload.get("tokenId")) if payload.get("tokenId") else None,
                summary="User logged out",
                details="All active user tokens were revoked using access token context.",
                context={"logout_via": "access_token"},
            )
            return {"message": "Logged out successfully"}
        except Exception:
            pass

    # Fallback: revoke via refresh token
    if body and body.get("refreshToken"):
        record = db.query(Token).filter(
            Token.refresh_token == body["refreshToken"],
            Token.is_revoked == False,
        ).first()
        if record:
            db.query(Token).filter(
                Token.user_id == record.user_id,
                Token.is_revoked == False,
            ).update({"is_revoked": True})
            db.commit()
            log_audit_event(
                db,
                action="auth_logout",
                event_type="auth",
                entity_type="session",
                user_id=record.user_id,
                summary="User logged out",
                details="All active user tokens were revoked using refresh token context.",
                context={"logout_via": "refresh_token"},
            )

    return {"message": "Logged out successfully"}


# ─── GET /api/auth/me ─────────────────────────────────────────────────────────
@router.get("/me")
def me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == uuid.UUID(current_user["userId"])).first()
    if not user:
        raise HTTPException(404, "User not found")

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "corporate_id": str(user.corporate_id) if user.corporate_id else None,
        "status": user.status,
        "phone_country": user.phone_country,
        "phone_number": user.phone_number,
    }
