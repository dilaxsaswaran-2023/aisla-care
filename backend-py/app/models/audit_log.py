import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    caregiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False)
    event_type = Column(String, nullable=True, index=True)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    source = Column(String, nullable=True, index=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        metadata = self.metadata_ or {}
        return {
            "id": str(self.id),
            "_id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "patient_id": str(self.patient_id) if self.patient_id else None,
            "caregiver_id": str(self.caregiver_id) if self.caregiver_id else None,
            "action": self.action,
            "event_type": self.event_type,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "source": self.source,
            "metadata": metadata,
            "summary": metadata.get("summary"),
            "details": metadata.get("details"),
            "severity": metadata.get("severity"),
            "outcome": metadata.get("outcome"),
            "context": metadata.get("context"),
            "changed_fields": metadata.get("changed_fields"),
            "change_count": metadata.get("change_count"),
            "changes": metadata.get("changes"),
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
