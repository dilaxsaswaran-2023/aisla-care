import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GpsLocation(Base):
    __tablename__ = "gps_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_gps_user_created", "user_id", "created_at"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "_id": str(self.id),
            "user_id": str(self.user_id),
            "latitude": self.latitude,
            "longitude": self.longitude,
            "accuracy": self.accuracy,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
