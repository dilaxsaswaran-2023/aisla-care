import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SosAlert(Base):
    __tablename__ = "sos_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    event_id = Column(String, nullable=False, unique=True, index=True)

    alert_type = Column(String, nullable=False, default="sos")
    priority = Column(String, nullable=False, default="high")   # low / medium / high / critical
    message = Column(Text, nullable=True)

    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    # is_acknowledged = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "event_id": self.event_id,
            "alert_type": self.alert_type,
            "priority": self.priority,
            "message": self.message,
            "is_read": self.is_read,
            # "is_acknowledged": self.is_acknowledged,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }