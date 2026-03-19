import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PatientAlert(Base):
	__tablename__ = "patient_alerts"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
	event_id = Column(String, nullable=False, index=True)

	case = Column(String, nullable=True)
	title = Column(String, nullable=False, default="Alert")
	alert_type = Column(String, nullable=False)
	message = Column(String, nullable=True)
	status = Column(String, nullable=False, default="active", server_default="active")
	source = Column(String, nullable=False, default="monitor", server_default="monitor")
	is_read = Column(Boolean, nullable=False, default=False, server_default="false")
	is_acknowledged = Column(Boolean, nullable=False, default=False, server_default="false")
	acknowledged_via = Column(String, nullable=True)

	created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
	updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

	def to_dict(self):
		return {
			"id": str(self.id),
			"patient_id": str(self.patient_id),
			"event_id": self.event_id,
			"case": self.case,
			"title": self.title,
			"alert_type": self.alert_type,
			"message": self.message,
			"status": self.status,
			"source": self.source,
			"is_read": self.is_read,
			"is_acknowledged": self.is_acknowledged,
			"acknowledged_via": self.acknowledged_via,
			"created_at": self.created_at.isoformat() if self.created_at else None,
			"updated_at": self.updated_at.isoformat() if self.updated_at else None,
		}


__all__ = ["PatientAlert"]
