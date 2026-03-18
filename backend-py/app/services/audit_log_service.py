import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger("audit.service")

_MASKED_FIELDS = {
    "password",
    "hashed_password",
    "token",
    "refresh_token",
    "access_token",
}


def _to_uuid(value: Any) -> Optional[uuid.UUID]:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _resolve_patient_caregiver_from_user(db: Session, user_id: Optional[uuid.UUID]):
    if not user_id:
        return None, None

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None, None

    if user.role == "patient":
        return user.id, user.caregiver_id
    if user.role == "caregiver":
        return None, user.id
    return None, user.caregiver_id


def _coalesce_actor_ids(
    db: Session,
    current_user: Optional[dict[str, Any]] = None,
    user_id: Any = None,
    patient_id: Any = None,
    caregiver_id: Any = None,
):
    actor_user_id = _to_uuid(user_id)
    actor_patient_id = _to_uuid(patient_id)
    actor_caregiver_id = _to_uuid(caregiver_id)

    if current_user:
        current_uid = _to_uuid(current_user.get("userId"))
        if not actor_user_id:
            actor_user_id = current_uid

        role = (current_user.get("role") or "").lower()
        if role == "patient" and not actor_patient_id:
            actor_patient_id = current_uid
        if role == "caregiver" and not actor_caregiver_id:
            actor_caregiver_id = current_uid

    if actor_user_id and (not actor_patient_id or not actor_caregiver_id):
        inferred_patient, inferred_caregiver = _resolve_patient_caregiver_from_user(db, actor_user_id)
        actor_patient_id = actor_patient_id or inferred_patient
        actor_caregiver_id = actor_caregiver_id or inferred_caregiver

    if actor_patient_id and not actor_caregiver_id:
        actor_caregiver_id = (
            db.query(User.caregiver_id)
            .filter(User.id == actor_patient_id)
            .scalar()
        )

    return actor_user_id, actor_patient_id, actor_caregiver_id


def build_field_changes(
    before: Optional[Mapping[str, Any]],
    after: Optional[Mapping[str, Any]],
    fields: Iterable[str],
) -> dict[str, dict[str, Any]]:
    before = before or {}
    after = after or {}

    changes: dict[str, dict[str, Any]] = {}
    for field in fields:
        old_value = before.get(field)
        new_value = after.get(field)
        if old_value == new_value:
            continue

        if field in _MASKED_FIELDS:
            old_value = "***" if old_value is not None else None
            new_value = "***" if new_value is not None else None

        changes[field] = {
            "old": str(old_value) if old_value is not None else None,
            "new": str(new_value) if new_value is not None else None,
        }

    return changes


def log_audit_event(
    db: Session,
    *,
    action: str,
    event_type: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    current_user: Optional[dict[str, Any]] = None,
    user_id: Any = None,
    patient_id: Any = None,
    caregiver_id: Any = None,
    source: str = "api",
    summary: Optional[str] = None,
    details: Optional[str] = None,
    context: Optional[dict[str, Any]] = None,
    changes: Optional[dict[str, Any]] = None,
    severity: str = "info",
    outcome: str = "success",
    ip_address: Optional[str] = None,
    commit: bool = True,
) -> Optional[AuditLog]:
    actor_user_id, actor_patient_id, actor_caregiver_id = _coalesce_actor_ids(
        db,
        current_user=current_user,
        user_id=user_id,
        patient_id=patient_id,
        caregiver_id=caregiver_id,
    )

    metadata: dict[str, Any] = {
        "summary": summary or action.replace("_", " "),
        "details": details,
        "severity": severity,
        "outcome": outcome,
        "context": context or {},
    }
    if changes:
        metadata["change_count"] = len(changes)
        metadata["changed_fields"] = list(changes.keys())
        metadata["changes"] = changes

    log = AuditLog(
        user_id=actor_user_id,
        patient_id=actor_patient_id,
        caregiver_id=actor_caregiver_id,
        action=action,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        source=source,
        metadata_=metadata,
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    try:
        db.add(log)
        if commit:
            db.commit()
            db.refresh(log)
        return log
    except Exception as exc:
        db.rollback()
        logger.warning("Audit logging failed for action=%s event_type=%s: %s", action, event_type, exc)
        return None
