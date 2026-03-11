import uuid
from datetime import datetime

from sqlalchemy import Column, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PatientGeofence(Base):
    __tablename__ = "patient_geofence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    home_lat = Column(Float, nullable=False)
    home_lng = Column(Float, nullable=False)
    radius_meters = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "home_lat": self.home_lat,
            "home_lng": self.home_lng,
            "radius_meters": self.radius_meters,
        }