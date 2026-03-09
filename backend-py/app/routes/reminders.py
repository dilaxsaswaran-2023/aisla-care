import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.reminder import Reminder
from app.auth import get_current_user

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


# GET /api/reminders
@router.get("/")
def list_reminders(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminders = (
        db.query(Reminder)
        .filter(Reminder.patient_id == uuid.UUID(current_user["userId"]))
        .order_by(Reminder.scheduled_time.asc())
        .limit(20)
        .all()
    )
    return [r.to_dict() for r in reminders]


# POST /api/reminders
@router.post("/", status_code=201)
def create_reminder(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient_id = body.get("patient_id") or current_user["userId"]
    reminder = Reminder(
        patient_id=uuid.UUID(patient_id),
        title=body["title"],
        description=body.get("description"),
        scheduled_time=body["scheduled_time"],
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder.to_dict()


# PATCH /api/reminders/:id/complete
@router.patch("/{reminder_id}/complete")
def complete_reminder(
    reminder_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = db.query(Reminder).filter(Reminder.id == uuid.UUID(reminder_id)).first()
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    reminder.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(reminder)
    return reminder.to_dict()
