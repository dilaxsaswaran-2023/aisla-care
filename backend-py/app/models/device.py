import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    device_type = Column(
        Enum("camera", "pir_sensor", "door_sensor", "wearable", "smart_plug", name="device_type_enum"),
        nullable=False,
    )
    name = Column(String, nullable=False)
    location = Column(String, nullable=False, default="")
    stream_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    last_reading_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "_id": str(self.id),
            "patient_id": str(self.patient_id),
            "device_type": self.device_type,
            "name": self.name,
            "location": self.location,
            "stream_url": self.stream_url,
            "is_active": self.is_active,
            "last_reading_at": self.last_reading_at.isoformat() if self.last_reading_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
