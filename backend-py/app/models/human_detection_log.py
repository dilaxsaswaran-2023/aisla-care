import uuid
from datetime import datetime

from sqlalchemy import Column, Boolean, DateTime, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class HumanDetectionLog(Base):
    __tablename__ = "human_detection_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    event_id = Column(String, nullable=False, unique=True, index=True)

    human_detected = Column(Boolean, nullable=False)

    detected_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "event_id": self.event_id,
            "human_detected": self.human_detected,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }