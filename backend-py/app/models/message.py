import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Index, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False, default="")
    message_type = Column(String, nullable=False, default="text")  # text | audio
    file_url = Column(String, nullable=True)
    file_metadata = Column(JSON, nullable=True)  # {"duration": 30, "size": 1024, "format": "webm"}
    status = Column(String, nullable=False, default="sent")  # sent | delivered | read
    read_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_msg_sender_recipient", "sender_id", "recipient_id"),
        Index("ix_msg_created", "created_at"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "_id": str(self.id),
            "sender_id": str(self.sender_id),
            "recipient_id": str(self.recipient_id),
            "content": self.content,
            "message_type": self.message_type,
            "file_url": self.file_url,
            "file_metadata": self.file_metadata,
            "status": self.status,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
