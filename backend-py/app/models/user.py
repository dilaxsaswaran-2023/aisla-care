import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, ARRAY, Boolean, Float, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(
        Enum("super_admin", "admin", "caregiver", "patient", "family", name="user_role"),
        nullable=False,
    )
    avatar_url = Column(String, nullable=True)
    phone_country = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    status = Column(
        Enum("invited", "active", "disabled", name="user_status"),
        nullable=False,
        server_default="active",
    )
    caregiver_type = Column(String, nullable=True)
    caregiver_subtype = Column(String, nullable=True)
    caregiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    caregiver_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True, default=[])
    corporate_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Many-to-many family_ids stored as an array of UUIDs
    family_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True, default=[])

    # ── Geofencing fields ────────────────────────────────────────────────────
    is_geofencing = Column(Boolean, nullable=False, default=False)
    location_boundary = Column(JSON, nullable=True)  # {latitude: float, longitude: float}
    boundary_radius = Column(Float, nullable=True)  # in meters
    geofence_state = Column(String, nullable=False, default="inside")  # inside | outside_candidate | outside_confirmed
    geofence_outside_count = Column(Integer, nullable=False, default=0)  # samples outside
    geofence_last_alert = Column(DateTime, nullable=True)  # last time exit alert was sent

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, exclude_password: bool = True):
        d = {
            "id": str(self.id),
            "_id": str(self.id),
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "avatar_url": self.avatar_url,
            "phone_country": self.phone_country,
            "phone_number": self.phone_number,
            "address": self.address,
            "status": self.status,
            "caregiver_type": self.caregiver_type,
            "caregiver_subtype": self.caregiver_subtype,
            "caregiver_id": str(self.caregiver_id) if self.caregiver_id else None,
            "caregiver_ids": [str(cid) for cid in self.caregiver_ids] if self.caregiver_ids else [],
            "corporate_id": str(self.corporate_id) if self.corporate_id else None,
            "family_ids": [str(fid) for fid in self.family_ids] if self.family_ids else [],
            # Geofencing
            "is_geofencing": self.is_geofencing,
            "location_boundary": self.location_boundary,
            "boundary_radius": self.boundary_radius,
            "geofence_state": self.geofence_state,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if not exclude_password:
            d["password"] = self.password
        return d
