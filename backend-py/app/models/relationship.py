import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    related_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    relationship_type = Column(
        Enum("caregiver", "family", name="relationship_type_enum"),
        nullable=False,
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("patient_id", "related_user_id", name="uq_patient_related"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "_id": str(self.id),
            "patient_id": str(self.patient_id),
            "related_user_id": str(self.related_user_id),
            "relationship_type": self.relationship_type,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
