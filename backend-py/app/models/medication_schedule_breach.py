import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class MedicationScheduleBreach(Base):
    __tablename__ = "medication_schedule_breaches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    medication_schedule_id = Column(UUID(as_uuid=True), ForeignKey("medication_schedules.id"), nullable=False, index=True)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("medication_schedules_monitor.id"), nullable=False, index=True)
    breach_found_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reason = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")  # active | acknowledged | resolved
    is_patient_alert = Column(Boolean, nullable=False, default=False, server_default="false")
    is_acknowledged = Column(Boolean, nullable=False, default=False, server_default="false")
    acknowledged_via = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "medication_schedule_id": str(self.medication_schedule_id),
            "monitor_id": str(self.monitor_id),
            "breach_found_at": self.breach_found_at.isoformat() if self.breach_found_at else None,
            "created_by": str(self.created_by) if self.created_by else None,
            "reason": self.reason,
            "status": self.status,
            "is_patient_alert": self.is_patient_alert,
            "is_acknowledged": self.is_acknowledged,
            "acknowledged_via": self.acknowledged_via,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
