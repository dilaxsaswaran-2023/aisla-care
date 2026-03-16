import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    prescription = Column(Text, nullable=True)
    schedule_type = Column(String, nullable=False, default="daily")  # "daily", "weekly", "selective"
    scheduled_times = Column(JSON, nullable=False)  # List of times ["09:00", "15:00"]
    days_of_week = Column(JSON, nullable=True)  # For weekly/selective: [0,1,2,3,4,5,6] where 0=Sunday
    meal_timing = Column(String, nullable=True)  # "before_meal", "after_meal", "with_meal"
    dosage_type = Column(String, nullable=True)  # "tablet", "capsule", "ml", "drops", etc.
    dosage_count = Column(Integer, nullable=True)  # Number of units
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "patient_id": str(self.patient_id),
            "created_by": str(self.created_by),
            "name": self.name,
            "description": self.description,
            "prescription": self.prescription,
            "schedule_type": self.schedule_type,
            "scheduled_times": self.scheduled_times,
            "days_of_week": self.days_of_week,
            "meal_timing": self.meal_timing,
            "dosage_type": self.dosage_type,
            "dosage_count": self.dosage_count,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
