import html
import logging
import re
import uuid
from typing import Optional

from sqlalchemy.orm import Session
from twilio.base.exceptions import TwilioException
from twilio.rest import Client

from app.config import get_settings
from app.models.budii_alert import PatientAlert
from app.models.relationship import Relationship
from app.models.user import User

logger = logging.getLogger("twilio.notifications")


def _normalize_phone(country_code: Optional[str], number: Optional[str]) -> Optional[str]:
    if not number:
        return None

    raw_number = str(number).strip()
    if not raw_number:
        return None

    raw_number = re.sub(r"[^\d+]", "", raw_number)
    if raw_number.startswith("00"):
        raw_number = f"+{raw_number[2:]}"

    if raw_number.startswith("+"):
        return raw_number

    country = (country_code or "").strip()
    if country:
        country = re.sub(r"[^\d+]", "", country)
        if country and not country.startswith("+"):
            country = f"+{country}"
        if country.startswith("+"):
            local = raw_number[1:] if raw_number.startswith("0") else raw_number
            return f"{country}{local}"

    if raw_number.isdigit() and len(raw_number) >= 8:
        return f"+{raw_number}"

    return None


def _build_twilio_client() -> tuple[Optional[Client], Optional[str]]:
    settings = get_settings()

    if not settings.twilio_account_sid or not settings.twilio_from_number:
        return None, None

    # Prefer auth token, fallback to API key + secret if provided.
    if settings.twilio_auth_token:
        return Client(settings.twilio_account_sid, settings.twilio_auth_token), settings.twilio_from_number

    api_key_sid = getattr(settings, "twilio_api_key_sid", "")
    api_key_secret = getattr(settings, "twilio_api_key_secret", "")
    if api_key_sid and api_key_secret:
        return (
            Client(api_key_sid, api_key_secret, settings.twilio_account_sid),
            settings.twilio_from_number,
        )

    return None, None


def _collect_recipient_numbers(db: Session, patient_id: uuid.UUID) -> list[str]:
    recipients: set[str] = set()

    patient = db.query(User).filter(User.id == patient_id).first()
    if patient:
        p = _normalize_phone(patient.phone_country, patient.phone_number)
        if p:
            recipients.add(p)

    related_ids = [
        row.related_user_id
        for row in db.query(Relationship.related_user_id)
        .filter(Relationship.patient_id == patient_id)
        .all()
    ]

    if related_ids:
        users = db.query(User).filter(User.id.in_(related_ids)).all()
        for user in users:
            phone = _normalize_phone(user.phone_country, user.phone_number)
            if phone:
                recipients.add(phone)

    settings = get_settings()
    test_to_number = getattr(settings, "twilio_test_to_number", "")
    test_phone = _normalize_phone(None, test_to_number) if test_to_number else None
    if test_phone:
        recipients.add(test_phone)

    return list(recipients)


def notify_patient_alert_created(db: Session, patient_alert: PatientAlert) -> dict:
    """Send SMS and voice call notifications for a newly created PatientAlert.

    This function is intentionally non-blocking from a caller perspective: failures are
    logged and returned as metadata so alert creation flow continues.
    """
    client, from_number = _build_twilio_client()
    if not client or not from_number:
        return {
            "enabled": False,
            "sms_sent": 0,
            "calls_sent": 0,
            "recipients": 0,
            "errors": ["Twilio is not configured"],
        }

    recipients = _collect_recipient_numbers(db, patient_alert.patient_id)
    if not recipients:
        return {
            "enabled": True,
            "sms_sent": 0,
            "calls_sent": 0,
            "recipients": 0,
            "errors": ["No recipient phone numbers found"],
        }

    patient = db.query(User).filter(User.id == patient_alert.patient_id).first()
    patient_name = patient.full_name if patient else "Patient"
    alert_type = (patient_alert.alert_type or "alert").replace("_", " ")

    sms_body = (
        f"AISLA Alert: {alert_type} for {patient_name}. "
        f"Alert ID: {str(patient_alert.id)[:8]}"
    )
    call_text = html.escape(
        f"AISLA emergency alert. {alert_type} detected for {patient_name}. "
        "Please check the AISLA app immediately."
    )

    sms_sent = 0
    calls_sent = 0
    errors: list[str] = []

    for to_number in recipients:
        try:
            client.messages.create(
                body=sms_body,
                from_=from_number,
                to=to_number,
            )
            sms_sent += 1
        except TwilioException as exc:
            msg = f"SMS failed to {to_number}: {exc}"
            errors.append(msg)
            logger.warning(msg)
        except Exception as exc:
            msg = f"SMS failed to {to_number}: {exc}"
            errors.append(msg)
            logger.warning(msg)

        try:
            client.calls.create(
                from_=from_number,
                to=to_number,
                twiml=f"<Response><Say>{call_text}</Say></Response>",
            )
            calls_sent += 1
        except TwilioException as exc:
            msg = f"Call failed to {to_number}: {exc}"
            errors.append(msg)
            logger.warning(msg)
        except Exception as exc:
            msg = f"Call failed to {to_number}: {exc}"
            errors.append(msg)
            logger.warning(msg)

    return {
        "enabled": True,
        "sms_sent": sms_sent,
        "calls_sent": calls_sent,
        "recipients": len(recipients),
        "errors": errors,
    }
