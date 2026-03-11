from contextlib import asynccontextmanager
from datetime import datetime
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.jwt_utils import init_jwt_secret
from app.seeder import seed_super_admin

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

settings = get_settings()

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

# Track online users: {user_id: sid}
_online_users: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # ── Startup ──────────────────────────────────────────────────────────────
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("[OK] Database tables created")

        # Init JWT secret and seed super-admin
        db = SessionLocal()
        try:
            init_jwt_secret(db)
            seed_super_admin(db)
        finally:
            db.close()
        print("[OK] JWT secret and super-admin initialized")
    except Exception as e:
        print(f"[WARN] Database initialization error: {type(e).__name__}: {e}")

    yield  # Application is running

    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("[OK] Application shutting down")


# ── Socket.IO server ─────────────────────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origin,
)


@sio.event
async def connect(sid, environ):
    print(f"[Socket] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    """Handle client disconnect."""
    user_id = next((uid for uid, s in _online_users.items() if s == sid), None)
    if user_id:
        del _online_users[user_id]
        await sio.emit("user_offline", {"user_id": user_id})
    print(f"[Socket] Client disconnected: {sid}")


@sio.event
async def join_room(sid, user_id: str):
    """User joins their personal room and announces they're online."""
    sio.enter_room(sid, user_id)
    _online_users[user_id] = sid
    await sio.emit("user_online", {"user_id": user_id})
    print(f"[Socket/Chat] User {user_id} joined room (sid={sid})")


@sio.event
async def send_message(sid, data: dict):
    """Persist a message and forward it to the recipient in real-time."""
    import uuid as _uuid
    from app.models.message import Message as MessageModel

    db = SessionLocal()
    try:
        msg = MessageModel(
            sender_id=_uuid.UUID(data["sender_id"]),
            recipient_id=_uuid.UUID(data["recipient_id"]),
            content=data.get("content", ""),
            message_type=data.get("message_type", "text"),
            file_url=data.get("file_url"),
            file_metadata=data.get("file_metadata"),
            status="sent",
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        msg_dict = msg.to_dict()

        # Deliver to recipient's room
        await sio.emit("new_message", msg_dict, room=data["recipient_id"])

        # Confirm delivery to sender
        await sio.emit(
            "message_status",
            {"message_id": str(msg.id), "status": "delivered"},
            room=sid,
        )
        return msg_dict
    except Exception as exc:
        print(f"[Socket/Chat] send_message error: {exc}")
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
                msg.read_at = datetime.utcnow()
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
app = FastAPI(title="AISLA Care Backend", lifespan=lifespan)
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

# Health check
@app.get("/api/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# Mount Socket.IO on the FastAPI app
socket_app = socketio.ASGIApp(sio, app)
