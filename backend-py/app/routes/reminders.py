import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.reminder import Reminder
from app.auth import get_current_user
from app.services.audit_log_service import log_audit_event

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

    log_audit_event(
        db,
        action="reminder_created",
        event_type="reminders",
        entity_type="reminder",
        entity_id=str(reminder.id),
        current_user=current_user,
        patient_id=reminder.patient_id,
        summary="Reminder created",
        details="A reminder was created for a patient.",
        context={
            "title": reminder.title,
            "scheduled_time": reminder.scheduled_time.isoformat() if reminder.scheduled_time else None,
        },
    )

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
    reminder.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reminder)

    log_audit_event(
        db,
        action="reminder_completed",
        event_type="reminders",
        entity_type="reminder",
        entity_id=str(reminder.id),
        current_user=current_user,
        patient_id=reminder.patient_id,
        summary="Reminder marked complete",
        details="A reminder completion was recorded.",
        context={
            "title": reminder.title,
            "completed_at": reminder.completed_at.isoformat() if reminder.completed_at else None,
        },
    )

    return reminder.to_dict()
