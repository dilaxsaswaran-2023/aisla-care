import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.message import Message
from app.auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])


# GET /api/messages/:recipientId
@router.get("/{recipient_id}")
def get_conversation(
    recipient_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    rec_id = uuid.UUID(recipient_id)

    messages = (
        db.query(Message)
        .filter(
            or_(
                (Message.sender_id == user_id) & (Message.recipient_id == rec_id),
                (Message.sender_id == rec_id) & (Message.recipient_id == user_id),
            )
        )
        .order_by(Message.created_at.asc())
        .limit(100)
        .all()
    )
    return [m.to_dict() for m in messages]


# POST /api/messages
@router.post("/", status_code=201)
def send_message(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = Message(
        sender_id=uuid.UUID(current_user["userId"]),
        recipient_id=uuid.UUID(body["recipient_id"]),
        content=body["content"],
        message_type=body.get("message_type", "text"),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message.to_dict()
