import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.database import get_db
from app.models.message import Message
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])

AUDIO_UPLOAD_DIR = "uploads/audio"
MAX_AUDIO_SIZE_MB = 10
ALLOWED_AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/mpeg", "audio/wav", "audio/mp4"}


def _ensure_upload_dir():
    os.makedirs(AUDIO_UPLOAD_DIR, exist_ok=True)


# ── GET /api/messages/conversations ─────────────────────────────────────────
@router.get("/conversations")
def get_conversations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return one entry per unique conversation partner with the latest message."""
    user_id = uuid.UUID(current_user["userId"])

    # All messages involving this user (not deleted)
    all_msgs = (
        db.query(Message)
        .filter(
            or_(Message.sender_id == user_id, Message.recipient_id == user_id),
            Message.is_deleted == False,
        )
        .order_by(Message.created_at.desc())
        .all()
    )

    seen: dict = {}
    for m in all_msgs:
        partner_id = str(m.recipient_id) if m.sender_id == user_id else str(m.sender_id)
        if partner_id not in seen:
            seen[partner_id] = m

    conversations = []
    for partner_id, last_msg in seen.items():
        partner = db.query(User).filter(User.id == uuid.UUID(partner_id)).first()
        unread = (
            db.query(func.count(Message.id))
            .filter(
                Message.sender_id == uuid.UUID(partner_id),
                Message.recipient_id == user_id,
                Message.status != "read",
                Message.is_deleted == False,
            )
            .scalar()
        )
        conversations.append(
            {
                "partner_id": partner_id,
                "partner_name": partner.full_name if partner else "Unknown",
                "partner_role": partner.role if partner else None,
                "last_message": last_msg.to_dict(),
                "unread_count": unread,
                "unread": unread > 0,
            }
        )

    # Sort by last message time desc
    conversations.sort(key=lambda c: c["last_message"]["created_at"] or "", reverse=True)
    return conversations


# ── POST /api/messages/upload-audio ─────────────────────────────────────────
@router.post("/upload-audio", status_code=201)
async def upload_audio(
    request: Request,
    file: UploadFile = File(...),
    recipient_id: str = Form(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate content type
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Invalid audio file type")

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_AUDIO_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Audio file exceeds {MAX_AUDIO_SIZE_MB}MB limit")

    _ensure_upload_dir()
    ext = (file.filename or "audio.webm").rsplit(".", 1)[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(AUDIO_UPLOAD_DIR, filename)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    file_url = f"/uploads/audio/{filename}"
    file_meta = {"size": len(content), "format": ext}

    message = Message(
        sender_id=uuid.UUID(current_user["userId"]),
        recipient_id=uuid.UUID(recipient_id),
        content="",
        message_type="audio",
        file_url=file_url,
        file_metadata=file_meta,
        status="sent",
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    msg_dict = message.to_dict()

    # Realtime fan-out for uploaded audio messages.
    sio = getattr(request.app.state, "sio", None)
    if sio:
        sender_id = current_user["userId"]
        await sio.emit("new_message", msg_dict, room=recipient_id)
        await sio.emit("new_message", msg_dict, room=sender_id)
        await sio.emit(
            "message_status",
            {"message_id": str(message.id), "status": message.status},
            room=sender_id,
        )

    return msg_dict


# ── GET /api/messages/search ─────────────────────────────────────────────────
@router.get("/search")
def search_messages(
    q: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    messages = (
        db.query(Message)
        .filter(
            or_(Message.sender_id == user_id, Message.recipient_id == user_id),
            Message.content.ilike(f"%{q}%"),
            Message.is_deleted == False,
        )
        .order_by(Message.created_at.desc())
        .limit(50)
        .all()
    )
    return [m.to_dict() for m in messages]


# ── POST /api/messages ───────────────────────────────────────────────────────
@router.post("/", status_code=201)
def send_message(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a text message."""
    message = Message(
        sender_id=uuid.UUID(current_user["userId"]),
        recipient_id=uuid.UUID(body["recipient_id"]),
        content=body.get("content", ""),
        message_type=body.get("message_type", "text"),
        file_url=body.get("file_url"),
        file_metadata=body.get("file_metadata"),
        status="sent",
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message.to_dict()


# ── GET /api/messages/{recipient_id} ────────────────────────────────────────
@router.get("/{recipient_id}")
def get_conversation(
    recipient_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    rec_id = uuid.UUID(recipient_id)

    messages = (
        db.query(Message)
        .filter(
            or_(
                and_(Message.sender_id == user_id, Message.recipient_id == rec_id),
                and_(Message.sender_id == rec_id, Message.recipient_id == user_id),
            ),
            Message.is_deleted == False,
        )
        .order_by(Message.created_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return [m.to_dict() for m in messages]


# ── PUT /api/messages/{recipient_id}/read-all ───────────────────────────────
@router.put("/{recipient_id}/read-all")
def mark_conversation_read(
    recipient_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    partner_id = uuid.UUID(recipient_id)

    unread_messages = (
        db.query(Message)
        .filter(
            Message.sender_id == partner_id,
            Message.recipient_id == user_id,
            Message.status != "read",
            Message.is_deleted == False,
        )
        .all()
    )

    now = datetime.now(timezone.utc)
    updated_ids = []
    for msg in unread_messages:
        msg.status = "read"
        msg.read_at = now
        updated_ids.append(str(msg.id))

    db.commit()

    return {"success": True, "message_ids": updated_ids, "count": len(updated_ids)}


# ── PUT /api/messages/{message_id}/read ──────────────────────────────────────
@router.put("/{message_id}/read")
def mark_message_read(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    msg = db.query(Message).filter(Message.id == uuid.UUID(message_id)).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.recipient_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    msg.status = "read"
    msg.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)
    return msg.to_dict()


# ── DELETE /api/messages/{message_id} ────────────────────────────────────────
@router.delete("/{message_id}", status_code=200)
def delete_message(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    msg = db.query(Message).filter(Message.id == uuid.UUID(message_id)).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    msg.is_deleted = True
    db.commit()
    return {"success": True}
