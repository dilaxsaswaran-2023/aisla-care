import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class MedicationScheduleMonitor(Base):
    __tablename__ = "medication_schedules_monitor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    medication_schedule_id = Column(UUID(as_uuid=True), ForeignKey("medication_schedules.id"), nullable=False, index=True)
    scheduled_for_at = Column(DateTime, nullable=False, index=True)
    due_at = Column(DateTime, nullable=False, index=True)
    taken_at = Column(DateTime, nullable=True)
    status = Column(String, nullable=False, default="pending")  # pending | taken | missed
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    checked_at = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "medication_schedule_id": str(self.medication_schedule_id),
            "scheduled_for_at": self.scheduled_for_at.isoformat() if self.scheduled_for_at else None,
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "taken_at": self.taken_at.isoformat() if self.taken_at else None,
            "status": self.status,
            "created_by": str(self.created_by) if self.created_by else None,
            "checked_at": self.checked_at.isoformat() if self.checked_at else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
