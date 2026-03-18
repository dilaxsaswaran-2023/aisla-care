from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.jwt_utils import init_jwt_secret
from app.jwt_utils import verify_access_token
from app.seeder import seed_super_admin
from app.services.geofence_scheduler import start_scheduler, stop_scheduler
from app.services.medication_scheduler import start_medication_scheduler, stop_medication_scheduler

# Initialize logging as early as possible
from app.logging_config import setup_logging
setup_logging()

# Route imports
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.alerts import router as alerts_router
from app.routes.devices import router as devices_router
from app.routes.gps import router as gps_router
from app.routes.messages import router as messages_router
from app.routes.relationships import router as relationships_router
from app.routes.reminders import router as reminders_router
from app.routes.audit_logs import router as audit_logs_router
from app.routes.consent_records import router as consent_records_router
from app.routes.geofence import router as geofence_router
from app.routes.ai import router as ai_router
from app.routes.budii import router as budii_router
from app.routes.budii_alert import router as budii_alert_router
from app.routes.monitor import router as monitor_router
from app.routes.medication_schedules import router as medication_schedules_router

settings = get_settings()
import logging
logger = logging.getLogger(__name__)

# Track online users: {user_id: sid}
_online_users: dict[str, str] = {}
_sid_to_user: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # ── Startup ──────────────────────────────────────────────────────────────
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("[DB] Database tables created")

        # Init JWT secret and seed super-admin
        db = SessionLocal()
        try:
            init_jwt_secret(db)
            seed_super_admin(db)
        finally:
            db.close()
        logger.info("[DB] JWT secret and super-admin initialized")
        
        # Start background geofence scheduler
        if settings.check_geofence_enabled:
            start_scheduler()
            logger.info("[Scheduler] Geofence scheduler started")

        # Start background medication scheduler
        if settings.check_medication_enabled:
            start_medication_scheduler()
            logger.info("[Scheduler] Medication scheduler started")
    except Exception as e:
        logger.warning(f"[WARN] Database initialization error: {type(e).__name__}: {e}")

    yield  # Application is running

    # ── Shutdown ─────────────────────────────────────────────────────────────
    stop_scheduler()
    stop_medication_scheduler()
    logger.info("[OK] Application shutting down")


# ── Socket.IO server ─────────────────────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origin,
)


@sio.event
async def connect(sid, environ, auth):
    """Authenticate socket connections using the same JWT access token."""
    token = None
    if isinstance(auth, dict):
        token = auth.get("token")

    if not token:
        logger.warning(f"[Socket] Rejecting unauthenticated client: {sid}")
        return False

    db = SessionLocal()
    try:
        payload = verify_access_token(db, token)
        user_id = payload.get("userId")
        if not user_id:
            return False
        _sid_to_user[sid] = user_id
        logger.info(f"[Socket] Client connected: {sid} (user={user_id})")
    except Exception:
        logger.warning(f"[Socket] Rejecting client with invalid token: {sid}")
        return False
    finally:
        db.close()


@sio.event
async def disconnect(sid):
    """Handle client disconnect."""
    user_id = _sid_to_user.pop(sid, None)
    if user_id:
        if _online_users.get(user_id) == sid:
            del _online_users[user_id]
            await sio.emit("user_offline", {"user_id": user_id})
    logger.info(f"[Socket] Client disconnected: {sid}")


@sio.event
async def join_room(sid, user_id: str):
    """User joins their personal room and announces they're online."""
    authenticated_user_id = _sid_to_user.get(sid)
    if not authenticated_user_id or authenticated_user_id != user_id:
        logger.warning(f"[Socket] join_room denied for sid={sid}, requested_user={user_id}")
        return

    await sio.enter_room(sid, user_id)
    _online_users[user_id] = sid
    await sio.emit("user_online", {"user_id": user_id})
    logger.info(f"[Socket/Chat] User {user_id} joined room (sid={sid})")


@sio.event
async def get_user_online_status(sid, data: dict):
    """Return current online status for a user (ack response)."""
    user_id = data.get("user_id") if isinstance(data, dict) else None
    if not user_id:
        return {"online": False}
    return {"online": user_id in _online_users}


@sio.event
async def send_message(sid, data: dict):
    """Persist a message and forward it to the recipient in real-time."""
    import uuid as _uuid
    from app.models.message import Message as MessageModel

    db = SessionLocal()
    try:
        recipient_id = data["recipient_id"]
        sender_id = data["sender_id"]
        recipient_online = recipient_id in _online_users

        msg = MessageModel(
            sender_id=_uuid.UUID(sender_id),
            recipient_id=_uuid.UUID(recipient_id),
            content=data.get("content", ""),
            message_type=data.get("message_type", "text"),
            file_url=data.get("file_url"),
            file_metadata=data.get("file_metadata"),
            status="delivered" if recipient_online else "sent",
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        msg_dict = msg.to_dict()

        # Deliver to recipient's room
        await sio.emit("new_message", msg_dict, room=recipient_id)

        # Dedicated notification event for recipient-side unread counters/toasts.
        await sio.emit(
            "chat_notification",
            {
                "sender_id": sender_id,
                "recipient_id": recipient_id,
                "content": msg_dict.get("content", ""),
                "message_type": msg_dict.get("message_type", "text"),
                "created_at": msg_dict.get("created_at"),
            },
            room=recipient_id,
        )

        # Also emit to sender room so sender sees persisted message immediately.
        await sio.emit("new_message", msg_dict, room=sender_id)

        # Confirm delivery to sender
        await sio.emit(
            "message_status",
            {"message_id": str(msg.id), "status": msg.status},
            room=sender_id,
        )
        return msg_dict
    except Exception as exc:
        logger.exception(f"[Socket/Chat] send_message error: {exc}")
        await sio.emit("message_error", {"error": str(exc)}, room=sid)
    finally:
        db.close()


@sio.event
async def typing_start(sid, data: dict):
    """Broadcast typing indicator."""
    await sio.emit(
        "typing_indicator",
        {"user_id": data["sender_id"], "is_typing": True},
        room=data["recipient_id"],
    )


@sio.event
async def typing_stop(sid, data: dict):
    """Stop typing indicator."""
    await sio.emit(
        "typing_indicator",
        {"user_id": data["sender_id"], "is_typing": False},
        room=data["recipient_id"],
    )


@sio.event
async def mark_read(sid, data: dict):
    """Mark messages as read."""
    import uuid as _uuid
    from app.models.message import Message as MessageModel

    db = SessionLocal()
    try:
        for mid in data.get("message_ids", []):
            msg = db.query(MessageModel).filter(MessageModel.id == _uuid.UUID(mid)).first()
            if msg and str(msg.recipient_id) == data["reader_id"]:
                msg.status = "read"
                msg.read_at = datetime.now(timezone.utc)
        db.commit()
        await sio.emit(
            "messages_read",
            {"message_ids": data["message_ids"], "reader_id": data["reader_id"]},
            room=data["sender_id"],
        )
    finally:
        db.close()


@sio.event
async def webrtc_signal(sid, data):
    """WebRTC signaling."""
    await sio.emit("webrtc-signal", data, room=data.get("to"))


@sio.event
async def call_end(sid, data):
    """WebRTC call ended."""
    await sio.emit("call-ended", data, room=data.get("to"))

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AISLA Care Backend API",
    description="Patient monitoring and caregiver coordination platform with real-time alerts.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.state.sio = sio

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded audio files statically
os.makedirs("uploads/audio", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register API routes
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(alerts_router)
app.include_router(devices_router)
app.include_router(gps_router)
app.include_router(messages_router)
app.include_router(relationships_router)
app.include_router(reminders_router)
app.include_router(audit_logs_router)
app.include_router(consent_records_router)
app.include_router(geofence_router)
app.include_router(ai_router)
app.include_router(budii_router)
app.include_router(budii_alert_router)
app.include_router(monitor_router)
app.include_router(medication_schedules_router)

# Health check
@app.get("/api/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

# Mount Socket.IO on the FastAPI app
socket_app = socketio.ASGIApp(sio, app)
