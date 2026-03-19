import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional

from app.database import get_db
from app.models.medication_schedule import MedicationSchedule
from app.models.medication_schedule_monitor import MedicationScheduleMonitor
from app.auth import get_current_user
from app.models.user import User
from app.services.audit_log_service import log_audit_event, build_field_changes

router = APIRouter(prefix="/api/medication-schedules", tags=["medication-schedules"])
LOCAL_TZ = ZoneInfo("Asia/Colombo")

# Pydantic models
class MedicationScheduleCreate(BaseModel):
    patient_id: str = Field(..., description="Patient UUID")
    name: str = Field(..., description="Medication name")
    description: Optional[str] = None
    prescription: Optional[str] = None
    schedule_type: str = Field("daily", description="Schedule type: daily, weekly, selective")
    scheduled_times: List[str] = Field(..., description="List of times in HH:MM format")
    days_of_week: Optional[List[int]] = Field(None, description="Days of week (0=Sunday, 6=Saturday) for weekly/selective")
    meal_timing: Optional[str] = Field(None, description="Meal timing: before_meal, after_meal, with_meal")
    dosage_type: Optional[str] = Field(None, description="Dosage type: tablet, capsule, ml, drops, etc.")
    dosage_count: Optional[int] = Field(None, description="Number of dosage units")
    urgency_level: str = Field("medium", description="Medication urgency: low, medium, high")
    grace_period_minutes: int = Field(60, description="Grace period in minutes: 30, 60, 120")
    is_active: bool = Field(True, description="Whether the schedule is active")

class MedicationScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prescription: Optional[str] = None
    schedule_type: Optional[str] = None
    scheduled_times: Optional[List[str]] = None
    days_of_week: Optional[List[int]] = None
    meal_timing: Optional[str] = None
    dosage_type: Optional[str] = None
    dosage_count: Optional[int] = None
    urgency_level: Optional[str] = None
    grace_period_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class MedicationTakePayload(BaseModel):
    taken_at: Optional[datetime] = None
    scheduled_for_at: Optional[str] = None
    notes: Optional[str] = None


def _get_accessible_patient_ids(db: Session, current_user: dict) -> List[uuid.UUID]:
    """Return patient IDs the caller is allowed to access."""
    from app.models.relationship import Relationship

    user_id = uuid.UUID(current_user["userId"])
    role = current_user.get("role")

    if role in ["super_admin", "admin"]:
        return [row.id for row in db.query(User.id).filter(User.role == "patient").all()]

    if role == "patient":
        return [user_id]

    relationship_rows = db.query(Relationship.patient_id).filter(
        Relationship.related_user_id == user_id,
        Relationship.patient_id.isnot(None),
    )

    if role == "family":
        relationship_rows = relationship_rows.filter(Relationship.relationship_type == "family")
        return [row.patient_id for row in relationship_rows.all()]

    if role == "caregiver":
        related_patient_ids = [row.patient_id for row in relationship_rows.all()]
        assigned_patient_ids = [
            row.id for row in db.query(User.id).filter(
                User.role == "patient",
                User.caregiver_id == user_id,
            ).all()
        ]
        return list(set(related_patient_ids + assigned_patient_ids))

    return []


def _has_patient_access(db: Session, current_user: dict, patient_id: uuid.UUID) -> bool:
    return patient_id in _get_accessible_patient_ids(db, current_user)


def _to_sunday_based_weekday(dt: datetime) -> int:
    return (dt.weekday() + 1) % 7


def _is_schedule_due_on_date(schedule: MedicationSchedule, date_value: datetime) -> bool:
    if schedule.schedule_type == "daily":
        return True
    days = schedule.days_of_week or []
    if not days:
        return False
    return _to_sunday_based_weekday(date_value) in days


@router.get("/monitor")
def list_medication_monitor_status(
    patient_id: str,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"[Medication Monitor] Fetching for patient_id={patient_id}, date={date}")
        
        try:
            patient_uuid = uuid.UUID(patient_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid patient_id")

        if not _has_patient_access(db, current_user, patient_uuid):
            raise HTTPException(status_code=403, detail="Access denied")

        if date:
            try:
                target_date = datetime.fromisoformat(date).date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD")
        else:
            target_date = datetime.now(LOCAL_TZ).date()

        day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=LOCAL_TZ)
        day_end = day_start + timedelta(days=1)

        schedules = db.query(MedicationSchedule).filter(
            MedicationSchedule.patient_id == patient_uuid,
            MedicationSchedule.is_active == True,
        ).order_by(MedicationSchedule.created_at.desc()).all()

        monitor_rows = db.query(MedicationScheduleMonitor).filter(
            MedicationScheduleMonitor.patient_id == patient_uuid,
            MedicationScheduleMonitor.scheduled_for_at >= day_start,
            MedicationScheduleMonitor.scheduled_for_at < day_end,
        ).all()

        monitor_by_key = {
            (str(row.medication_schedule_id), row.scheduled_for_at.strftime("%H:%M")): row
            for row in monitor_rows
        }

        now = datetime.now(LOCAL_TZ)
        items = []
        for schedule in schedules:
            if not _is_schedule_due_on_date(schedule, day_start):
                continue

            for time_value in schedule.scheduled_times or []:
                try:
                    hour, minute = map(int, str(time_value).split(":"))
                except Exception:
                    logger.warning(f"[Medication Monitor] Invalid time format: {time_value}")
                    continue

                scheduled_for_at = day_start.replace(hour=hour, minute=minute, second=0, microsecond=0)
                due_at = scheduled_for_at + timedelta(minutes=int(schedule.grace_period_minutes or 60))

                monitor = monitor_by_key.get((str(schedule.id), str(time_value)))
                if monitor:
                    status = monitor.status
                    taken_at = monitor.taken_at
                else:
                    status = "missed" if now > due_at else "pending"
                    taken_at = None

                items.append({
                    "schedule_id": str(schedule.id),
                    "medication_name": schedule.name,
                    "description": schedule.description,
                    "urgency_level": schedule.urgency_level,
                    "time": str(time_value),
                    "scheduled_for_at": scheduled_for_at.isoformat(),
                    "due_at": due_at.isoformat(),
                    "status": status,
                    "taken_at": taken_at.isoformat() if taken_at else None,
                    "monitor_id": str(monitor.id) if monitor else None,
                    "can_mark_done": status != "taken",
                })

        items.sort(key=lambda item: item["scheduled_for_at"])
        logger.info(f"[Medication Monitor] Successfully fetched {len(items)} items for patient {patient_id}")
        return {"date": target_date.isoformat(), "items": items}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Medication Monitor] Error fetching medication monitor data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch medication monitor data")

# GET /api/medication-schedules - List all medication schedules for current user's patients
@router.get("/")
def list_medication_schedules(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accessible_patient_ids = _get_accessible_patient_ids(db, current_user)

    if not accessible_patient_ids:
        return []

    query = db.query(MedicationSchedule).filter(
        MedicationSchedule.patient_id.in_(accessible_patient_ids)
    )

    if patient_id:
        try:
            pid = uuid.UUID(patient_id)
            if pid not in accessible_patient_ids:
                raise HTTPException(status_code=403, detail="Access denied")
            query = query.filter(MedicationSchedule.patient_id == pid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid patient_id")

    schedules = query.order_by(MedicationSchedule.created_at.desc()).all()
    return [s.to_dict() for s in schedules]

# GET /api/medication-schedules/{id} - Get specific medication schedule
@router.get("/{schedule_id}")
def get_medication_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        sid = uuid.UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schedule ID")
    
    schedule = db.query(MedicationSchedule).filter(MedicationSchedule.id == sid).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Medication schedule not found")

    if not _has_patient_access(db, current_user, schedule.patient_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return schedule.to_dict()

# POST /api/medication-schedules - Create new medication schedule
@router.post("/", status_code=201)
def create_medication_schedule(
    body: MedicationScheduleCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])

    try:
        patient_uuid = uuid.UUID(body.patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patient_id")

    if not _has_patient_access(db, current_user, patient_uuid):
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate schedule_type
    if body.schedule_type not in ["daily", "weekly", "selective"]:
        raise HTTPException(status_code=400, detail="Invalid schedule_type")

    # Validate meal_timing
    if body.meal_timing and body.meal_timing not in ["before_meal", "after_meal", "with_meal"]:
        raise HTTPException(status_code=400, detail="Invalid meal_timing")

    # Validate urgency_level
    if body.urgency_level not in ["low", "medium", "high"]:
        raise HTTPException(status_code=400, detail="Invalid urgency_level")

    # Validate grace_period_minutes
    if body.grace_period_minutes not in [30, 60, 120]:
        raise HTTPException(status_code=400, detail="Invalid grace_period_minutes")

    # Validate days_of_week for weekly/selective
    if body.schedule_type in ["weekly", "selective"] and not body.days_of_week:
        raise HTTPException(status_code=400, detail="days_of_week required for weekly/selective schedules")

    if body.days_of_week:
        for day in body.days_of_week:
            if not (0 <= day <= 6):
                raise HTTPException(status_code=400, detail="days_of_week must be 0-6 (Sunday=0)")

    schedule = MedicationSchedule(
        patient_id=patient_uuid,
        created_by=user_id,
        name=body.name,
        description=body.description,
        prescription=body.prescription,
        schedule_type=body.schedule_type,
        scheduled_times=body.scheduled_times,
        days_of_week=body.days_of_week,
        meal_timing=body.meal_timing,
        dosage_type=body.dosage_type,
        dosage_count=body.dosage_count,
        urgency_level=body.urgency_level,
        grace_period_minutes=body.grace_period_minutes,
        is_active=body.is_active,
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    log_audit_event(
        db,
        action="medication_schedule_created",
        event_type="medication",
        entity_type="medication_schedule",
        entity_id=str(schedule.id),
        current_user=current_user,
        patient_id=schedule.patient_id,
        summary="Medication schedule created",
        details="A medication schedule was created for a patient.",
        context={
            "name": schedule.name,
            "schedule_type": schedule.schedule_type,
            "urgency_level": schedule.urgency_level,
            "times": schedule.scheduled_times,
        },
    )

    return schedule.to_dict()

# PATCH /api/medication-schedules/{id} - Update medication schedule
@router.patch("/{schedule_id}")
def update_medication_schedule(
    schedule_id: str,
    body: MedicationScheduleUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        sid = uuid.UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schedule ID")
    
    schedule = db.query(MedicationSchedule).filter(MedicationSchedule.id == sid).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Medication schedule not found")

    if not _has_patient_access(db, current_user, schedule.patient_id):
        raise HTTPException(status_code=403, detail="Access denied")

    before = {
        "name": schedule.name,
        "description": schedule.description,
        "prescription": schedule.prescription,
        "schedule_type": schedule.schedule_type,
        "scheduled_times": schedule.scheduled_times,
        "days_of_week": schedule.days_of_week,
        "meal_timing": schedule.meal_timing,
        "dosage_type": schedule.dosage_type,
        "dosage_count": schedule.dosage_count,
        "urgency_level": schedule.urgency_level,
        "grace_period_minutes": schedule.grace_period_minutes,
        "is_active": schedule.is_active,
    }

    # Validate schedule_type
    if body.schedule_type and body.schedule_type not in ["daily", "weekly", "selective"]:
        raise HTTPException(status_code=400, detail="Invalid schedule_type")

    # Validate meal_timing
    if body.meal_timing and body.meal_timing not in ["before_meal", "after_meal", "with_meal"]:
        raise HTTPException(status_code=400, detail="Invalid meal_timing")

    # Validate urgency_level
    if body.urgency_level and body.urgency_level not in ["low", "medium", "high"]:
        raise HTTPException(status_code=400, detail="Invalid urgency_level")

    # Validate grace_period_minutes
    if body.grace_period_minutes is not None and body.grace_period_minutes not in [30, 60, 120]:
        raise HTTPException(status_code=400, detail="Invalid grace_period_minutes")

    # Validate days_of_week for weekly/selective
    if body.schedule_type in ["weekly", "selective"] and body.days_of_week is not None and not body.days_of_week:
        raise HTTPException(status_code=400, detail="days_of_week required for weekly/selective schedules")

    if body.days_of_week:
        for day in body.days_of_week:
            if not (0 <= day <= 6):
                raise HTTPException(status_code=400, detail="days_of_week must be 0-6 (Sunday=0)")

    # Update fields
    update_fields = [
        "name", "description", "prescription", "schedule_type", "scheduled_times",
        "days_of_week", "meal_timing", "dosage_type", "dosage_count",
        "urgency_level", "grace_period_minutes", "is_active"
    ]

    for field in update_fields:
        value = getattr(body, field, None)
        if value is not None:
            setattr(schedule, field, value)

    schedule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schedule)

    after = {
        "name": schedule.name,
        "description": schedule.description,
        "prescription": schedule.prescription,
        "schedule_type": schedule.schedule_type,
        "scheduled_times": schedule.scheduled_times,
        "days_of_week": schedule.days_of_week,
        "meal_timing": schedule.meal_timing,
        "dosage_type": schedule.dosage_type,
        "dosage_count": schedule.dosage_count,
        "urgency_level": schedule.urgency_level,
        "grace_period_minutes": schedule.grace_period_minutes,
        "is_active": schedule.is_active,
    }
    changes = build_field_changes(
        before,
        after,
        [
            "name",
            "description",
            "prescription",
            "schedule_type",
            "scheduled_times",
            "days_of_week",
            "meal_timing",
            "dosage_type",
            "dosage_count",
            "urgency_level",
            "grace_period_minutes",
            "is_active",
        ],
    )

    log_audit_event(
        db,
        action="medication_schedule_updated",
        event_type="medication",
        entity_type="medication_schedule",
        entity_id=str(schedule.id),
        current_user=current_user,
        patient_id=schedule.patient_id,
        summary="Medication schedule updated",
        details="Medication schedule settings were updated.",
        changes=changes,
        context={"name": schedule.name},
    )

    return schedule.to_dict()

# DELETE /api/medication-schedules/{id} - Delete medication schedule
@router.delete("/{schedule_id}")
def delete_medication_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        sid = uuid.UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schedule ID")
    
    schedule = db.query(MedicationSchedule).filter(MedicationSchedule.id == sid).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Medication schedule not found")

    if not _has_patient_access(db, current_user, schedule.patient_id):
        raise HTTPException(status_code=403, detail="Access denied")

    context = {
        "name": schedule.name,
        "schedule_type": schedule.schedule_type,
        "patient_id": str(schedule.patient_id),
    }

    db.delete(schedule)
    db.commit()

    log_audit_event(
        db,
        action="medication_schedule_deleted",
        event_type="medication",
        entity_type="medication_schedule",
        entity_id=schedule_id,
        current_user=current_user,
        patient_id=context["patient_id"],
        summary="Medication schedule deleted",
        details="A medication schedule was removed.",
        context=context,
        severity="warning",
    )

    return {"success": True}


@router.patch("/{schedule_id}/toggle-active")
def toggle_medication_schedule_active(
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        sid = uuid.UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schedule ID")

    schedule = db.query(MedicationSchedule).filter(MedicationSchedule.id == sid).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Medication schedule not found")

    if not _has_patient_access(db, current_user, schedule.patient_id):
        raise HTTPException(status_code=403, detail="Access denied")

    schedule.is_active = not bool(schedule.is_active)
    schedule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schedule)

    log_audit_event(
        db,
        action="medication_schedule_toggled",
        event_type="medication",
        entity_type="medication_schedule",
        entity_id=str(schedule.id),
        current_user=current_user,
        patient_id=schedule.patient_id,
        summary="Medication schedule activation toggled",
        details="Medication schedule active state was toggled.",
        context={
            "name": schedule.name,
            "is_active": str(schedule.is_active),
        },
    )

    return {"success": True, "is_active": schedule.is_active}


@router.post("/{schedule_id}/mark-taken")
def mark_medication_taken(
    schedule_id: str,
    body: MedicationTakePayload,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        sid = uuid.UUID(schedule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schedule ID")

    schedule = db.query(MedicationSchedule).filter(MedicationSchedule.id == sid).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Medication schedule not found")

    if not _has_patient_access(db, current_user, schedule.patient_id):
        raise HTTPException(status_code=403, detail="Access denied")

    taken_at = body.taken_at or datetime.now(timezone.utc)
    if taken_at.tzinfo is not None:
        taken_at = taken_at.replace(tzinfo=None)

    # If scheduled_for_at is provided, use it directly
    if body.scheduled_for_at:
        try:
            scheduled_for_at = datetime.fromisoformat(body.scheduled_for_at)
            if scheduled_for_at.tzinfo is not None:
                scheduled_for_at = scheduled_for_at.replace(tzinfo=None)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_for_at format")
        due_at = scheduled_for_at + timedelta(minutes=int(schedule.grace_period_minutes or 60))
    else:
        # Find nearest due schedule window for this dose (today/yesterday).
        candidates = []
        for day_offset in [0, -1]:
            base_date = taken_at + timedelta(days=day_offset)
            if not _is_schedule_due_on_date(schedule, base_date):
                continue
            for time_value in schedule.scheduled_times or []:
                try:
                    hour, minute = map(int, str(time_value).split(":"))
                except Exception:
                    continue
                scheduled_for_at = base_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
                due_at = scheduled_for_at + timedelta(minutes=int(schedule.grace_period_minutes or 60))
                candidates.append((scheduled_for_at, due_at))

        if not candidates:
            raise HTTPException(status_code=400, detail="No valid scheduled times found")

        # Pick the closest schedule occurrence to the taken time.
        scheduled_for_at, due_at = min(candidates, key=lambda item: abs((taken_at - item[0]).total_seconds()))

    user_id = uuid.UUID(current_user["userId"])
    monitor = (
        db.query(MedicationScheduleMonitor)
        .filter(
            MedicationScheduleMonitor.patient_id == schedule.patient_id,
            MedicationScheduleMonitor.medication_schedule_id == schedule.id,
            MedicationScheduleMonitor.scheduled_for_at == scheduled_for_at,
        )
        .first()
    )

    if not monitor:
        monitor = MedicationScheduleMonitor(
            patient_id=schedule.patient_id,
            medication_schedule_id=schedule.id,
            scheduled_for_at=scheduled_for_at,
            due_at=due_at,
            created_by=user_id,
        )
        db.add(monitor)

    monitor.taken_at = taken_at
    monitor.status = "taken"
    monitor.notes = body.notes
    monitor.checked_at = datetime.now(LOCAL_TZ)

    db.commit()
    db.refresh(monitor)

    log_audit_event(
        db,
        action="medication_marked_taken",
        event_type="medication",
        entity_type="medication_schedule_monitor",
        entity_id=str(monitor.id),
        current_user=current_user,
        patient_id=schedule.patient_id,
        summary="Medication dose marked as taken",
        details="A scheduled medication dose was marked as taken.",
        context={
            "schedule_id": str(schedule.id),
            "schedule_name": schedule.name,
            "scheduled_for_at": scheduled_for_at.isoformat(),
            "taken_at": taken_at.isoformat(),
            "status": monitor.status,
        },
    )

    return {"success": True, "monitor": monitor.to_dict()}