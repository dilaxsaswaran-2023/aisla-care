import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GeofenceBreachEvent(Base):
    __tablename__ = "geofence_breach_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    distance_meters = Column(Float, nullable=True)
    breached_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
