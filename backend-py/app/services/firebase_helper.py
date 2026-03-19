"""
Firebase Admin SDK – Firestore helper.

Initialises the Firebase Admin SDK once and exposes a function to push
PatientAlert documents to the ``patient_alerts`` Firestore collection so
the frontend can listen for real-time updates.
"""
import os
import logging
from datetime import date, datetime
from pathlib import Path
from uuid import UUID

import firebase_admin
from firebase_admin import credentials, firestore

_db = None
logger = logging.getLogger("firebase.helper")


def _candidate_credential_paths() -> list[Path]:
    """Build candidate locations for Firebase service account credentials."""
    backend_root = Path(__file__).resolve().parents[2]
    cwd = Path.cwd()

    env_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-service-account.json")
    env_path_obj = Path(env_path)

    candidates: list[Path] = []
    if env_path_obj.is_absolute():
        candidates.append(env_path_obj)
    else:
        candidates.extend(
            [
                cwd / env_path_obj,
                backend_root / env_path_obj,
                backend_root / "firebase-service-account.json",
            ]
        )

    # Keep order while removing duplicates.
    unique: list[Path] = []
    seen: set[str] = set()
    for item in candidates:
        key = str(item.resolve()) if item.exists() else str(item)
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _to_firestore_safe(value):
    """Convert values that Firestore can't serialize directly."""
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _to_firestore_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_firestore_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_to_firestore_safe(v) for v in value]
    return value


def _init():
    """Lazily initialise the Firebase Admin SDK."""
    global _db
    if _db is not None:
        return

    try:
        if not firebase_admin._apps:
            candidates = _candidate_credential_paths()
            credential_path = next((p for p in candidates if p.is_file()), None)

            if credential_path is not None:
                cred = credentials.Certificate(str(credential_path))
                firebase_admin.initialize_app(cred)
                logger.info("[FIREBASE] Firebase Admin initialized using %s", credential_path)
            else:
                logger.warning(
                    "[FIREBASE] Service account file not found. Tried: %s. Falling back to ADC.",
                    ", ".join(str(p) for p in candidates),
                )
                # Fallback to Application Default Credentials when a local key file is not available.
                firebase_admin.initialize_app()
                logger.info("[FIREBASE] Firebase Admin initialized using Application Default Credentials")
        _db = firestore.client()
    except Exception as exc:
        logger.exception("[FIREBASE] Initialization failed: %s", exc)
        _db = None


def push_patient_alert(alert_dict: dict) -> bool:
    """
    Write a PatientAlert document to Firestore under
    ``patient_alerts/{alert_id}``.

    Returns True on success, False if Firebase is not configured or on error.
    """
    _init()
    if _db is None:
        logger.warning("[FIREBASE] Firestore client not available; push skipped")
        return False

    try:
        doc_id = alert_dict.get("id") or alert_dict.get("_id")
        if not doc_id:
            logger.warning("[FIREBASE] Missing alert id/_id in payload; push skipped")
            return False

        normalized_payload = dict(alert_dict)
        # Always include a dedicated patient_alert_id in Firestore payload.
        if not normalized_payload.get("patient_alert_id"):
            normalized_payload["patient_alert_id"] = str(doc_id)

        safe_payload = _to_firestore_safe(normalized_payload)
        _db.collection("patient_alerts").document(str(doc_id)).set(safe_payload)
        logger.info("[FIREBASE] Pushed patient_alert doc_id=%s patient_id=%s", doc_id, alert_dict.get("patient_id"))
        return True
    except Exception as exc:
        logger.exception("[FIREBASE] Push failed for doc_id=%s: %s", alert_dict.get("id") or alert_dict.get("_id"), exc)
        return False
