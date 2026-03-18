import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import event, select
from sqlalchemy.orm import Mapper

from app.models.audit_log import AuditLog
from app.models.user import User


_REGISTERED = False

# High-frequency operational tables that add noise in admin audit history.
_EXCLUDED_TABLES = {
    "messages",
    "gps_locations",
    "patient_current_location",
    "patient_location_recent",
}

# Ignore purely technical fields when computing update diffs.
_IGNORED_CHANGE_FIELDS = {
    "updated_at",
    "created_at",
}

# Avoid leaking sensitive data into audit diffs.
_MASKED_FIELDS = {
    "password",
    "hashed_password",
    "token",
    "refresh_token",
    "access_token",
}

_ENTITY_LABELS = {
    "users": "user",
    "relationships": "relationship",
    "alerts": "alert",
    "sos_alerts": "sos_alert",
    "devices": "device",
    "reminders": "reminder",
    "consent_records": "consent_record",
    "tokens": "session",
    "medication_schedules": "medication_schedule",
    "medication_schedules_breach": "medication_breach",
    "geofence_breach_events": "geofence_breach",
}

_OPERATION_VERBS = {
    "insert": "created",
    "update": "updated",
    "delete": "deleted",
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


def _resolve_patient_caregiver_from_user(connection, user_id: Optional[uuid.UUID]):
    if not user_id:
        return None, None

    row = connection.execute(
        select(User.id, User.role, User.caregiver_id).where(User.id == user_id).limit(1)
    ).first()
    if not row:
        return None, None

    if row.role == "patient":
        return row.id, row.caregiver_id
    if row.role == "caregiver":
        return None, row.id
    return None, row.caregiver_id


def _extract_involved_ids(connection, target) -> tuple[Optional[uuid.UUID], Optional[uuid.UUID], Optional[uuid.UUID]]:
    table_name = getattr(target, "__tablename__", "")

    patient_id = _to_uuid(getattr(target, "patient_id", None))
    caregiver_id = _to_uuid(getattr(target, "caregiver_id", None))

    user_id = _to_uuid(getattr(target, "user_id", None))
    created_by = _to_uuid(getattr(target, "created_by", None))
    related_user_id = _to_uuid(getattr(target, "related_user_id", None))

    if not user_id and created_by:
        user_id = created_by

    if table_name == "users":
        uid = _to_uuid(getattr(target, "id", None))
        role = getattr(target, "role", None)
        if role == "patient":
            patient_id = patient_id or uid
            caregiver_id = caregiver_id or _to_uuid(getattr(target, "caregiver_id", None))
        elif role == "caregiver":
            caregiver_id = caregiver_id or uid
        user_id = user_id or uid

    if table_name == "relationships":
        relationship_type = getattr(target, "relationship_type", None)
        if relationship_type == "caregiver":
            caregiver_id = caregiver_id or related_user_id

    if user_id and (not patient_id or not caregiver_id):
        user_patient_id, user_caregiver_id = _resolve_patient_caregiver_from_user(connection, user_id)
        patient_id = patient_id or user_patient_id
        caregiver_id = caregiver_id or user_caregiver_id

    if patient_id and not caregiver_id:
        caregiver_id = connection.execute(
            select(User.caregiver_id).where(User.id == patient_id).limit(1)
        ).scalar_one_or_none()

    return user_id, patient_id, caregiver_id


def _extract_changes(target) -> dict[str, Any]:
    from sqlalchemy import inspect

    state = inspect(target)
    changes: dict[str, Any] = {}
    for attr in state.attrs:
        if attr.key in _IGNORED_CHANGE_FIELDS:
            continue

        history = attr.history
        if not history.has_changes():
            continue

        old_value = history.deleted[0] if history.deleted else None
        new_value = history.added[0] if history.added else getattr(target, attr.key, None)

        if attr.key in _MASKED_FIELDS:
            old_value = "***"
            new_value = "***"

        changes[attr.key] = {
            "old": str(old_value) if old_value is not None else None,
            "new": str(new_value) if new_value is not None else None,
        }
    return changes


def _extract_context(target) -> dict[str, Any]:
    context_fields = [
        "name",
        "full_name",
        "email",
        "role",
        "status",
        "relationship_type",
        "device_id",
        "patient_id",
        "caregiver_id",
        "user_id",
    ]

    context: dict[str, Any] = {}
    for field in context_fields:
        if not hasattr(target, field):
            continue
        value = getattr(target, field, None)
        if value is None:
            continue
        context[field] = str(value)
    return context


def _get_entity_label(table_name: str) -> str:
    if table_name in _ENTITY_LABELS:
        return _ENTITY_LABELS[table_name]
    if table_name.endswith("ies"):
        return f"{table_name[:-3]}y"
    if table_name.endswith("s"):
        return table_name[:-1]
    return table_name


def _build_action(table_name: str, operation: str) -> str:
    entity_label = _get_entity_label(table_name)
    verb = _OPERATION_VERBS.get(operation, operation)
    return f"{entity_label}_{verb}"


def _write_log(connection, operation: str, target) -> None:
    table_name = getattr(target, "__tablename__", None)
    if not table_name or table_name == "audit_logs" or table_name in _EXCLUDED_TABLES:
        return

    entity_id = getattr(target, "id", None)
    source = getattr(target, "source", None) or "api"

    user_id, patient_id, caregiver_id = _extract_involved_ids(connection, target)

    changes: dict[str, Any] = {}
    if operation == "update":
        changes = _extract_changes(target)
        # Skip logs where only ignored/technical fields changed.
        if not changes:
            return

    metadata = {
        "operation": operation,
        "table": table_name,
        "entity": _get_entity_label(table_name),
        "summary": f"{_get_entity_label(table_name)} {_OPERATION_VERBS.get(operation, operation)}",
        "context": _extract_context(target),
    }
    if operation == "update":
        metadata["change_count"] = len(changes)
        metadata["changed_fields"] = list(changes.keys())
        metadata["changes"] = changes

    now = datetime.now(timezone.utc)
    connection.execute(
        AuditLog.__table__.insert().values(
            user_id=user_id,
            patient_id=patient_id,
            caregiver_id=caregiver_id,
            action=_build_action(table_name, operation),
            event_type=table_name,
            entity_type=table_name,
            entity_id=str(entity_id) if entity_id else None,
            source=str(source),
            metadata=metadata,
            created_at=now,
            updated_at=now,
        )
    )


def _after_insert(mapper, connection, target):
    _write_log(connection, "insert", target)


def _after_update(mapper, connection, target):
    _write_log(connection, "update", target)


def _after_delete(mapper, connection, target):
    _write_log(connection, "delete", target)


def register_audit_event_listeners() -> None:
    global _REGISTERED
    if _REGISTERED:
        return

    event.listen(Mapper, "after_insert", _after_insert)
    event.listen(Mapper, "after_update", _after_update)
    event.listen(Mapper, "after_delete", _after_delete)
    _REGISTERED = True
