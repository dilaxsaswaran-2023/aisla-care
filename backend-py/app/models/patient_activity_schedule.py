import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Time
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PatientActivitySchedule(Base):
    __tablename__ = "patient_activity_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    activity_name = Column(String, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)