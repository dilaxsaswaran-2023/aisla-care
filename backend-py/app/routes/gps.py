import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.gps_location import GpsLocation
from app.auth import get_current_user

router = APIRouter(prefix="/api/gps", tags=["gps"])


# POST /api/gps
@router.post("/", status_code=201)
def create_gps(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    location = GpsLocation(
        user_id=uuid.UUID(current_user["userId"]),
        latitude=body["latitude"],
        longitude=body["longitude"],
        accuracy=body.get("accuracy", 0),
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location.to_dict()


# GET /api/gps/latest
@router.get("/latest")
def latest_gps(
    userId: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_id = uuid.UUID(userId) if userId else uuid.UUID(current_user["userId"])
    location = (
        db.query(GpsLocation)
        .filter(GpsLocation.user_id == target_id)
        .order_by(GpsLocation.created_at.desc())
        .first()
    )
    return location.to_dict() if location else None
