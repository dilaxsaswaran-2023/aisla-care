import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.patient_alert import PatientAlert
from app.models.patient_alert_relationship import PatientAlertRelationship
from app.models.geofence_breach_event import GeofenceBreachEvent
from app.models.medication_schedule_breach import MedicationScheduleBreach
from app.models.patient_inactivity_log import PatientInactivityLog
from app.models.relationship import Relationship
from app.models.sos_alert import SosAlert
from app.models.user import User

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertAcknowledgeRequest(BaseModel):
    how: str


def _get_accessible_patient_ids(db: Session, current_user: dict) -> list[uuid.UUID]:
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


def _patient_name_map(db: Session, patient_ids: list[uuid.UUID]) -> dict[str, str]:
    if not patient_ids:
        return {}
    rows = db.query(User.id, User.full_name).filter(User.id.in_(patient_ids)).all()
    return {str(r.id): r.full_name for r in rows}


def _patient_contact_map(db: Session, patient_ids: list[uuid.UUID]) -> dict[str, dict]:
    if not patient_ids:
        return {}
    rows = (
        db.query(User.id, User.full_name, User.phone_country, User.phone_number)
        .filter(User.id.in_(patient_ids))
        .all()
    )
    return {
        str(r.id): {
            "name": r.full_name,
            "phone_country": r.phone_country,
            "phone_number": r.phone_number,
        }
        for r in rows
    }


def _sort_timestamp(value: Optional[str]) -> datetime:
    if not value:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


@router.get("/me")
def my_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient_ids = _get_accessible_patient_ids(db, current_user)
    if not patient_ids:
        return []

    patient_name_by_id = _patient_name_map(db, patient_ids)
    patient_contact_by_id = _patient_contact_map(db, patient_ids)
    patient_alert_rows = (
        db.query(PatientAlert)
        .filter(
            PatientAlert.patient_id.in_(patient_ids),
            PatientAlert.source.in_(["sos", "geofence", "inactivity", "medication"]),
        )
        .all()
    )
    patient_alert_by_source_event: dict[tuple[str, str], PatientAlert] = {
        ((row.source or "").strip().lower(), str(row.event_id)): row
        for row in patient_alert_rows
        if row.event_id
    }
    result: list[dict] = []

    sos_alerts = (
        db.query(SosAlert)
        .filter(
            SosAlert.patient_id.in_(patient_ids),
            SosAlert.is_patient_alert == False,
        )
        .order_by(SosAlert.created_at.desc())
        .limit(100)
        .all()
    )
    for item in sos_alerts:
        linked_patient_alert = patient_alert_by_source_event.get(("sos", str(item.id)))
        result.append(
            {
                "id": str(item.id),
                "patient_alert_id": str(linked_patient_alert.id) if linked_patient_alert else None,
                "event_id": item.event_id,
                "patient_id": str(item.patient_id),
                "patient_name": patient_name_by_id.get(str(item.patient_id), "Unknown"),
                "alert_type": "sos",
                "status": "active",
                "priority": item.priority or "high",
                "title": "SOS Emergency Alert",
                "message": item.message or "Patient triggered SOS button",
                "is_read": bool(item.is_read),
                "is_acknowledged": bool(getattr(linked_patient_alert, "is_acknowledged", False)),
                "acknowledged_via": getattr(linked_patient_alert, "acknowledged_via", None),
                "patient_phone_country": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_country"),
                "patient_phone_number": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_number"),
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "source": "sos",
            }
        )

    geofence_events = (
        db.query(GeofenceBreachEvent)
        .filter(
            GeofenceBreachEvent.patient_id.in_(patient_ids),
            GeofenceBreachEvent.is_patient_alert == False,
        )
        .order_by(GeofenceBreachEvent.breached_at.desc())
        .limit(100)
        .all()
    )
    for item in geofence_events:
        linked_patient_alert = patient_alert_by_source_event.get(("geofence", str(item.id)))
        result.append(
            {
                "id": str(item.id),
                "patient_alert_id": str(linked_patient_alert.id) if linked_patient_alert else None,
                "event_id": str(item.id),
                "patient_id": str(item.patient_id),
                "patient_name": patient_name_by_id.get(str(item.patient_id), "Unknown"),
                "alert_type": "geofence_breach",
                "status": "active",
                "priority": "high",
                "title": "Geofence Breach Detected",
                "message": f"Patient is outside the safe zone (distance: {round(item.distance_meters or 0, 1)}m)",
                "is_read": True,
                "is_acknowledged": bool(getattr(linked_patient_alert, "is_acknowledged", False)),
                "acknowledged_via": getattr(linked_patient_alert, "acknowledged_via", None),
                "patient_phone_country": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_country"),
                "patient_phone_number": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_number"),
                "latitude": item.latitude,
                "longitude": item.longitude,
                "created_at": item.breached_at.isoformat() if item.breached_at else None,
                "source": "geofence",
            }
        )

    inactivity_events = (
        db.query(PatientInactivityLog)
        .filter(
            PatientInactivityLog.patient_id.in_(patient_ids),
            PatientInactivityLog.is_patient_alert == False,
        )
        .order_by(PatientInactivityLog.inactivity_time.desc())
        .limit(100)
        .all()
    )
    for item in inactivity_events:
        linked_patient_alert = patient_alert_by_source_event.get(("inactivity", str(item.id)))
        result.append(
            {
                "id": str(item.id),
                "patient_alert_id": str(linked_patient_alert.id) if linked_patient_alert else None,
                "event_id": str(item.id),
                "patient_id": str(item.patient_id),
                "patient_name": patient_name_by_id.get(str(item.patient_id), "Unknown"),
                "alert_type": "inactivity",
                "status": "active",
                "priority": "medium",
                "title": "Patient Inactivity Detected",
                "message": f"Inactivity type: {item.inactivity_type}",
                "is_read": True,
                "is_acknowledged": bool(getattr(linked_patient_alert, "is_acknowledged", False)),
                "acknowledged_via": getattr(linked_patient_alert, "acknowledged_via", None),
                "patient_phone_country": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_country"),
                "patient_phone_number": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_number"),
                "created_at": item.inactivity_time.isoformat() if item.inactivity_time else None,
                "source": "inactivity",
            }
        )

    medication_events = (
        db.query(MedicationScheduleBreach)
        .filter(
            MedicationScheduleBreach.patient_id.in_(patient_ids),
            MedicationScheduleBreach.is_patient_alert == False,
        )
        .order_by(MedicationScheduleBreach.breach_found_at.desc())
        .limit(100)
        .all()
    )
    for item in medication_events:
        priority = "high" if "high" in (item.reason or "").lower() else "medium"
        linked_patient_alert = patient_alert_by_source_event.get(("medication", str(item.id)))
        result.append(
            {
                "id": str(item.id),
                "patient_alert_id": str(linked_patient_alert.id) if linked_patient_alert else None,
                "event_id": str(item.id),
                "patient_id": str(item.patient_id),
                "patient_name": patient_name_by_id.get(str(item.patient_id), "Unknown"),
                "alert_type": "medication_breach",
                "status": item.status or "active",
                "priority": priority,
                "title": "Medication Schedule Breach",
                "message": item.reason or "Medication was not taken on time",
                "is_read": True,
                "is_acknowledged": bool(getattr(linked_patient_alert, "is_acknowledged", False)),
                "acknowledged_via": getattr(linked_patient_alert, "acknowledged_via", None),
                "patient_phone_country": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_country"),
                "patient_phone_number": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_number"),
                "created_at": item.breach_found_at.isoformat() if item.breach_found_at else None,
                "source": "medication",
            }
        )

    user_id = uuid.UUID(current_user["userId"])
    patient_alert_rel = (
        db.query(PatientAlertRelationship)
        .filter(
            (PatientAlertRelationship.caregiver_id == user_id)
            | (PatientAlertRelationship.family_id == user_id)
        )
        .all()
    )
    patient_alert_ids = [row.patient_alert_id for row in patient_alert_rel]

    if patient_alert_ids:
        patient_alerts = (
            db.query(PatientAlert)
            .filter(PatientAlert.id.in_(patient_alert_ids))
            .order_by(PatientAlert.created_at.desc())
            .limit(100)
            .all()
        )
        for item in patient_alerts:
            result.append(
                {
                    "id": str(item.id),
                    "patient_alert_id": str(item.id),
                    "event_id": item.event_id,
                    "patient_id": str(item.patient_id),
                    "patient_name": patient_name_by_id.get(str(item.patient_id), "Unknown"),
                    "alert_type": item.alert_type,
                    "status": "active",
                    "priority": "high",
                    "title": item.title,
                    "message": item.title,
                    "is_read": bool(item.is_read),
                    "is_acknowledged": bool(getattr(item, "is_acknowledged", False)),
                    "acknowledged_via": getattr(item, "acknowledged_via", None),
                    "patient_phone_country": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_country"),
                    "patient_phone_number": patient_contact_by_id.get(str(item.patient_id), {}).get("phone_number"),
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                    "source": "budii",
                }
            )

    result.sort(key=lambda x: _sort_timestamp(x.get("created_at")), reverse=True)

    return result[:200]


@router.patch("/{source}/{alert_id}/acknowledge")
def acknowledge_alert(
    source: str,
    alert_id: str,
    body: AlertAcknowledgeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        parsed_alert_id = uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    if not body.how or not body.how.strip():
        raise HTTPException(status_code=400, detail="Acknowledgement method is required")

    normalized_source = (source or "").strip().lower()
    patient_ids = _get_accessible_patient_ids(db, current_user)
    how = body.how.strip().lower()

    if not patient_ids and current_user.get("role") not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="No accessible patients")

    if normalized_source == "budii":
        patient_alert = (
            db.query(PatientAlert)
            .filter(
                PatientAlert.id == parsed_alert_id,
                PatientAlert.patient_id.in_(patient_ids),
            )
            .first()
        )
    elif normalized_source in ["sos", "geofence", "inactivity", "medication"]:
        patient_alert = (
            db.query(PatientAlert)
            .filter(
                PatientAlert.source == normalized_source,
                PatientAlert.event_id == str(parsed_alert_id),
                PatientAlert.patient_id.in_(patient_ids),
            )
            .order_by(PatientAlert.created_at.desc())
            .first()
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported alert source")

    if not patient_alert:
        raise HTTPException(status_code=404, detail="Patient alert not found for this source alert")

    patient_alert.is_acknowledged = True
    patient_alert.acknowledged_via = how
    db.add(patient_alert)
    db.commit()

    return {
        "success": True,
        "id": str(patient_alert.id),
        "patient_alert_id": str(patient_alert.id),
        "source": normalized_source,
        "is_acknowledged": True,
        "acknowledged_via": how,
    }


@router.patch("/mark-read-all")
def mark_all_alerts_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient_ids = _get_accessible_patient_ids(db, current_user)

    if patient_ids:
        db.query(SosAlert).filter(
            SosAlert.patient_id.in_(patient_ids),
            SosAlert.is_read == False,
        ).update({"is_read": True}, synchronize_session="fetch")

    user_id = uuid.UUID(current_user["userId"])
    rel_ids = [
        r.patient_alert_id
        for r in db.query(PatientAlertRelationship)
        .filter(
            (PatientAlertRelationship.caregiver_id == user_id)
            | (PatientAlertRelationship.family_id == user_id)
        )
        .all()
    ]

    if rel_ids:
        db.query(PatientAlert).filter(
            PatientAlert.id.in_(rel_ids),
            PatientAlert.is_read == False,
        ).update({"is_read": True}, synchronize_session="fetch")

    db.commit()
    return {"success": True}
