import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.device import Device
from app.auth import get_current_user
from app.services.audit_log_service import log_audit_event, build_field_changes

router = APIRouter(prefix="/api/devices", tags=["devices"])


# GET /api/devices
@router.get("/")
def list_devices(
    patientId: str = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Device)
    if patientId:
        query = query.filter(Device.patient_id == uuid.UUID(patientId))
    devices = query.order_by(Device.created_at.desc()).all()
    return [d.to_dict() for d in devices]


# POST /api/devices
@router.post("/", status_code=201)
def create_device(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = Device(
        patient_id=uuid.UUID(body["patient_id"]),
        device_type=body["device_type"],
        name=body["name"],
        location=body.get("location", ""),
        stream_url=body.get("stream_url"),
        is_active=body.get("is_active", True),
    )
    db.add(device)
    db.commit()
    db.refresh(device)

    log_audit_event(
        db,
        action="device_created",
        event_type="device_management",
        entity_type="device",
        entity_id=str(device.id),
        current_user=current_user,
        patient_id=device.patient_id,
        summary="Device created",
        details="A monitoring device was registered for a patient.",
        context={
            "name": device.name,
            "device_type": device.device_type,
            "is_active": str(device.is_active),
        },
    )

    return device.to_dict()


# PATCH /api/devices/:id
@router.patch("/{device_id}")
def update_device(
    device_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == uuid.UUID(device_id)).first()
    if not device:
        raise HTTPException(404, "Device not found")

    before = {
        "name": device.name,
        "location": device.location,
        "stream_url": device.stream_url,
        "is_active": device.is_active,
        "device_type": device.device_type,
    }

    for key in ["name", "location", "stream_url", "is_active", "device_type", "last_reading_at"]:
        if key in body:
            setattr(device, key, body[key])

    db.commit()
    db.refresh(device)

    after = {
        "name": device.name,
        "location": device.location,
        "stream_url": device.stream_url,
        "is_active": device.is_active,
        "device_type": device.device_type,
    }
    changes = build_field_changes(before, after, ["name", "location", "stream_url", "is_active", "device_type"])

    log_audit_event(
        db,
        action="device_updated",
        event_type="device_management",
        entity_type="device",
        entity_id=str(device.id),
        current_user=current_user,
        patient_id=device.patient_id,
        summary="Device settings updated",
        details="One or more device fields were changed.",
        context={
            "name": device.name,
            "device_type": device.device_type,
        },
        changes=changes,
    )

    return device.to_dict()


# DELETE /api/devices/:id
@router.delete("/{device_id}")
def delete_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == uuid.UUID(device_id)).first()
    if not device:
        raise HTTPException(404, "Device not found")

    context = {
        "name": device.name,
        "device_type": device.device_type,
        "patient_id": str(device.patient_id),
    }

    db.delete(device)
    db.commit()

    log_audit_event(
        db,
        action="device_deleted",
        event_type="device_management",
        entity_type="device",
        entity_id=device_id,
        current_user=current_user,
        patient_id=context["patient_id"],
        summary="Device removed",
        details="A device registration was deleted.",
        context=context,
        severity="warning",
    )

    return {"success": True}
