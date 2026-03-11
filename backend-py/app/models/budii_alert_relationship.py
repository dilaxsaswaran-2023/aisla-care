import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BudiiAlertRelationship(Base):
    __tablename__ = "budii_alert_relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_alert_id = Column(UUID(as_uuid=True), ForeignKey("patient_alerts.id"), nullable=False, index=True)
    caregiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    family_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "_id": str(self.id),
            "patient_alert_id": str(self.patient_alert_id),
            "caregiver_id": str(self.caregiver_id) if self.caregiver_id else None,
            "family_id": str(self.family_id) if self.family_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
