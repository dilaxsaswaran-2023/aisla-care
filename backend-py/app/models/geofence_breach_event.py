import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Float, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GeofenceBreachEvent(Base):
    __tablename__ = "geofence_breach_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    distance_meters = Column(Float, nullable=True)
    is_patient_alert = Column(Boolean, nullable=False, default=False, server_default="false")
    is_acknowledged = Column(Boolean, nullable=False, default=False, server_default="false")
    acknowledged_via = Column(String, nullable=True)
    breached_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
