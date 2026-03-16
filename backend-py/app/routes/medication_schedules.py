import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional

from app.database import get_db
from app.models.medication_schedule import MedicationSchedule
from app.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/medication-schedules", tags=["medication-schedules"])

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
    is_active: Optional[bool] = None

# GET /api/medication-schedules - List all medication schedules for current user's patients
@router.get("/")
def list_medication_schedules(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    
    # Get patients that this user can access (caregiver or family)
    from app.models.relationship import Relationship
    accessible_patient_ids = []
    
    # If user is caregiver or family, get their patients
    relationships = db.query(Relationship).filter(
        Relationship.related_user_id == user_id,
        Relationship.patient_id.isnot(None)
    ).all()
    accessible_patient_ids.extend([str(r.patient_id) for r in relationships])
    
    # Remove duplicates
    accessible_patient_ids = list(set(accessible_patient_ids))
    
    if not accessible_patient_ids:
        return []
    
    query = db.query(MedicationSchedule).filter(
        MedicationSchedule.patient_id.in_([uuid.UUID(pid) for pid in accessible_patient_ids])
    )
    
    if patient_id:
        try:
            pid = uuid.UUID(patient_id)
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
    
    # Check if user has access to this patient's schedules
    user_id = uuid.UUID(current_user["userId"])
    from app.models.relationship import Relationship
    has_access = db.query(Relationship).filter(
        ((Relationship.caregiver_id == user_id) | (Relationship.family_id == user_id)) &
        (Relationship.patient_id == schedule.patient_id)
    ).first()
    
    if not has_access:
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
    
    # Check if user has access to this patient
    from app.models.relationship import Relationship
    has_access = db.query(Relationship).filter(
        (Relationship.related_user_id == user_id) &
        (Relationship.patient_id == uuid.UUID(body.patient_id))
    ).first()
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate schedule_type
    if body.schedule_type not in ["daily", "weekly", "selective"]:
        raise HTTPException(status_code=400, detail="Invalid schedule_type")
    
    # Validate meal_timing
    if body.meal_timing and body.meal_timing not in ["before_meal", "after_meal", "with_meal"]:
        raise HTTPException(status_code=400, detail="Invalid meal_timing")
    
    # Validate days_of_week for weekly/selective
    if body.schedule_type in ["weekly", "selective"] and not body.days_of_week:
        raise HTTPException(status_code=400, detail="days_of_week required for weekly/selective schedules")
    
    if body.days_of_week:
        for day in body.days_of_week:
            if not (0 <= day <= 6):
                raise HTTPException(status_code=400, detail="days_of_week must be 0-6 (Sunday=0)")
    
    schedule = MedicationSchedule(
        patient_id=uuid.UUID(body.patient_id),
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
        is_active=body.is_active,
    )
    
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
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
    
    # Check if user has access to this patient's schedules
    user_id = uuid.UUID(current_user["userId"])
    from app.models.relationship import Relationship
    has_access = db.query(Relationship).filter(
        (Relationship.related_user_id == user_id) &
        (Relationship.patient_id == schedule.patient_id)
    ).first()
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate schedule_type
    if body.schedule_type and body.schedule_type not in ["daily", "weekly", "selective"]:
        raise HTTPException(status_code=400, detail="Invalid schedule_type")
    
    # Validate meal_timing
    if body.meal_timing and body.meal_timing not in ["before_meal", "after_meal", "with_meal"]:
        raise HTTPException(status_code=400, detail="Invalid meal_timing")
    
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
        "days_of_week", "meal_timing", "dosage_type", "dosage_count", "is_active"
    ]
    
    for field in update_fields:
        value = getattr(body, field, None)
        if value is not None:
            setattr(schedule, field, value)
    
    schedule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(schedule)
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
    
    # Check if user has access to this patient's schedules
    user_id = uuid.UUID(current_user["userId"])
    from app.models.relationship import Relationship
    has_access = db.query(Relationship).filter(
        (Relationship.related_user_id == user_id) &
        (Relationship.patient_id == schedule.patient_id)
    ).first()
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(schedule)
    db.commit()
    return {"success": True}