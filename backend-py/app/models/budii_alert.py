import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PatientAlert(Base):
    __tablename__ = "patient_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    event_id = Column(String, nullable=False, index=True)

    # case = Column(String, nullable=True)
    alert_type = Column(String, nullable=False)
    # title = Column(String, nullable=False)
    # message = Column(Text, nullable=True)
    # status = Column(String, nullable=False, default="active")
    # source = Column(String, nullable=False, default="budii")
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "event_id": self.event_id,
            # "case": self.case,
            "alert_type": self.alert_type,
            # "title": self.title,
            # "message": self.message,
            # "status": self.status,
            # "source": self.source,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }