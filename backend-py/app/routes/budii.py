import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.budii_alert import PatientAlert
from app.models.user import User
from app.services.twilio_notifications import notify_patient_alert_created
from app.services.audit_log_service import log_audit_event

logger = logging.getLogger("aisla.budii")

router = APIRouter(prefix="/api/internal", tags=["Internal Budii"])


class BudiiRuleResult(BaseModel):
    triggered: bool | None = None
    case: str | None = None
    action: str | None = None
    reason: str | None = None


class BudiiAction(BaseModel):
    case: str
    action: str
    reason: str | None = None


class BudiiResult(BaseModel):
    triggered: bool
    rules_triggered: List[BudiiRuleResult] = Field(default_factory=list)


class BudiiAlertPayload(BaseModel):
    event_id: str
    patient_id: str
    result: BudiiResult
    actions: List[BudiiAction] = Field(default_factory=list)


@router.post("/budii-alert")
async def receive_budii_alert(
    payload: BudiiAlertPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    logger.info(
        f"[BUDII] Received event_id={payload.event_id} "
        f"patient_id={payload.patient_id} actions={payload.actions}"
    )

    internal_key = request.headers.get("X-Internal-Key")
    if internal_key != "budii-secret-123":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not payload.actions:
        return {"status": "ignored", "reason": "no actions"}

    created_alerts = []
    created_alert_models = []
    sio = request.app.state.sio

    for action in payload.actions:
        new_alert = PatientAlert(
            patient_id=payload.patient_id,
            event_id=payload.event_id,
            alert_type=action.case,
            title=action.reason or action.case,
        )
        if action.case != "SOS_TRIGGER":    
            db.add(new_alert)
            db.flush()
            created_alert_models.append(new_alert)

            alert_data = new_alert.to_dict()
            created_alerts.append(alert_data)

            await sio.emit("new_alert", alert_data)

    db.commit()

    for alert_model in created_alert_models:
        try:
            notify_patient_alert_created(db, alert_model)
        except Exception as exc:
            logger.warning(f"[BUDII] Twilio notification failed for patient_alert={alert_model.id}: {exc}")

    for created in created_alerts:
        log_audit_event(
            db,
            action="budii_internal_alert_created",
            event_type="budii_alerts",
            entity_type="patient_alert",
            entity_id=created.get("id"),
            patient_id=payload.patient_id,
            summary="Budii internal alert created",
            details="Internal Budii ingestion created a patient alert entry.",
            context={
                "event_id": payload.event_id,
                "alert_type": created.get("alert_type"),
                "source": "internal_budii",
            },
        )

    return {
        "status": "received",
        "alerts_created": len(created_alerts),
        "alerts": created_alerts,
    }


# POST /api/internal/test-twilio
@router.post("/test-twilio")
def test_twilio_notifications(
    phone_number: str,
    message: str | None = None,
    db: Session = Depends(get_db),
):
    """
    TEST ENDPOINT - Send 3 SMS and 1 call to test Twilio integration.
    
    This endpoint creates a temporary alert record and sends notifications
    to the specified phone number. Useful for validating Twilio setup.
    
    Args:
        phone_number: Destination phone number (e.g., +94763911998 or +18392102874)
        message: Optional alert type (default: "test_alert")
    
    Returns:
        Notification delivery status with SMS/call counts
    """
    import uuid
    from datetime import datetime, timezone
    from twilio.rest import Client
    from twilio.base.exceptions import TwilioException
    from app.config import get_settings
    
    settings = get_settings()
    
    # Validate Twilio config
    if not settings.twilio_account_sid or not settings.twilio_from_number:
        return {
            "status": "error",
            "message": "Twilio not configured",
            "details": "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env"
        }
    
    if not settings.twilio_auth_token:
        return {
            "status": "error",
            "message": "Twilio auth token not configured",
            "details": "Set TWILIO_AUTH_TOKEN in .env"
        }
    
    # Create test alert in database
    test_patient = db.query(User).filter(User.role == "patient").first()
    patient_id = test_patient.id if test_patient else uuid.uuid4()
    
    alert_type_value = message or "test_alert"
    test_alert = PatientAlert(
        patient_id=patient_id,
        event_id=str(uuid.uuid4()),
        alert_type=alert_type_value,
        title=f"Twilio Test - {alert_type_value}",
    )
    db.add(test_alert)
    db.commit()
    db.refresh(test_alert)
    
    logger.info(f"[TEST-TWILIO] Created test alert {test_alert.id}")
    
    # Initialize Twilio client
    try:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        from_number = settings.twilio_from_number
    except Exception as e:
        return {
            "status": "error",
            "message": "Failed to initialize Twilio client",
            "details": str(e)
        }
    
    # Send 3 SMS
    sms_sent = 0
    sms_errors = []
    for i in range(1, 4):
        try:
            body = f"[AISLA Test {i}/3] Twilio SMS delivery test at {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
            msg = client.messages.create(
                body=body,
                from_=from_number,
                to=phone_number,
            )
            sms_sent += 1
            logger.info(f"[TEST-TWILIO] SMS {i}/3 sent (SID: {msg.sid})")
        except TwilioException as e:
            sms_errors.append(f"SMS {i}: {str(e)}")
            logger.warning(f"[TEST-TWILIO] SMS {i} failed: {e}")
        except Exception as e:
            sms_errors.append(f"SMS {i}: {str(e)}")
            logger.warning(f"[TEST-TWILIO] SMS {i} error: {e}")
    
    # Make 1 call
    calls_sent = 0
    call_error = None
    try:
        call_text = "This is an emergency alert test from AISLA care system. Please acknowledge receipt. Thank you."
        twiml = f"<Response><Say>{call_text}</Say></Response>"
        call = client.calls.create(
            from_=from_number,
            to=phone_number,
            twiml=twiml,
        )
        calls_sent = 1
        logger.info(f"[TEST-TWILIO] Call initiated (SID: {call.sid})")
    except TwilioException as e:
        call_error = str(e)
        logger.warning(f"[TEST-TWILIO] Call failed: {e}")
    except Exception as e:
        call_error = str(e)
        logger.warning(f"[TEST-TWILIO] Call error: {e}")
    
    return {
        "status": "success" if (sms_sent > 0 or calls_sent > 0) else "partial",
        "test_alert_id": str(test_alert.id),
        "recipient": phone_number,
        "sms": {
            "sent": sms_sent,
            "total": 3,
            "errors": sms_errors if sms_errors else None,
        },
        "calls": {
            "sent": calls_sent,
            "total": 1,
            "error": call_error,
        },
        "info": "Check Twilio Console for delivery status and call recordings"
    }