"""
Firebase Admin SDK – Firestore helper.

Initialises the Firebase Admin SDK once and exposes a function to push
PatientAlert documents to the ``patient_alerts`` Firestore collection so
the frontend can listen for real-time updates.
"""
import os

import firebase_admin
from firebase_admin import credentials, firestore

_db = None


def _init():
    """Lazily initialise the Firebase Admin SDK."""
    global _db
    if _db is not None:
        return

    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-service-account.json")
    if not os.path.isfile(cred_path):
        return

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    _db = firestore.client()


def push_patient_alert(alert_dict: dict) -> bool:
    """
    Write a PatientAlert document to Firestore under
    ``patient_alerts/{alert_id}``.

    Returns True on success, False if Firebase is not configured or on error.
    """
    _init()
    if _db is None:
        return False

    try:
        doc_id = alert_dict.get("id") or alert_dict.get("_id")
        if not doc_id:
            return False

        _db.collection("patient_alerts").document(doc_id).set(alert_dict)
        return True
    except Exception:
        return False
