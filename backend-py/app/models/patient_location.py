from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.database import Base


class PatientCurrentLocation(Base):
    """Stores the latest location only for each patient."""
    __tablename__ = "patient_current_location"

    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "patient_id": str(self.patient_id),
            "lat": self.lat,
            "lng": self.lng,
            "accuracy": self.accuracy,
            "captured_at": self.captured_at.isoformat() if self.captured_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PatientLocationRecent(Base):
    """Stores the last 10 location records per patient."""
    __tablename__ = "patient_location_recent"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Index for fast retrieval of last 10 records per patient
    __table_args__ = (
        Index("ix_patient_location_recent_patient_captured", "patient_id", "captured_at", postgresql_using="btree"),
        UniqueConstraint("patient_id", "captured_at", name="uq_patient_location_recent_unique"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "lat": self.lat,
            "lng": self.lng,
            "accuracy": self.accuracy,
            "captured_at": self.captured_at.isoformat() if self.captured_at else None,
        }
