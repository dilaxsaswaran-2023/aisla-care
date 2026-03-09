from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from app.routes.ai import router as ai_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✔ Database tables created")

    # Init JWT secret and seed super-admin
    db = SessionLocal()
    try:
        init_jwt_secret(db)
        seed_super_admin(db)
    finally:
        db.close()

    yield  # Application is running

    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("Shutting down...")


# ── Socket.IO server ─────────────────────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origin,
)


@sio.event
async def connect(sid, environ):
    print(f"Socket connected: {sid}")


@sio.event
async def join(sid, user_id):
    sio.enter_room(sid, user_id)
    print(f"User {user_id} joined room")


@sio.event
async def webrtc_signal(sid, data):
    await sio.emit("webrtc-signal", data, room=data.get("to"))


@sio.event
async def call_end(sid, data):
    await sio.emit("call-ended", data, room=data.get("to"))


@sio.event
async def disconnect(sid):
    print(f"Socket disconnected: {sid}")


# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(title="AISLA Care Backend", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(ai_router)


# Health check
@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# Mount Socket.IO as sub-application
socket_app = socketio.ASGIApp(sio, app)
