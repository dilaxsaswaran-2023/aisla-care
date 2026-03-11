import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    alert_type = Column(
        Enum("sos", "fall", "geofence", "inactivity", "health", name="alert_type_enum"),
        nullable=False,
    )
    status = Column(String, nullable=False, default="active", index=True)
    priority = Column(String, nullable=False, default="medium")
    title = Column(String, nullable=False)
    message = Column(String, nullable=False, default="")
    voice_transcription = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "_id": str(self.id),
            "patient_id": str(self.patient_id),
            "alert_type": self.alert_type,
            "status": self.status,
            "priority": self.priority,
            "title": self.title,
            "message": self.message,
            "voice_transcription": self.voice_transcription,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
