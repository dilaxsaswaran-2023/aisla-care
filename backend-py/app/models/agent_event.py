import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AgentEvent(Base):
    """Stores processed event results from the Budii LangGraph agent."""

    __tablename__ = "agent_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(String, nullable=False, index=True)
    patient_id = Column(String, nullable=False, index=True)  # UUID string from real events
    timestamp = Column(String, nullable=False)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "event_id": self.event_id,
            "patient_id": self.patient_id,
            "timestamp": self.timestamp,
            "result_json": self.result_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
