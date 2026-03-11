import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.services.monitor import MonitorEvent, process_event

logger = logging.getLogger("monitor.router")
router = APIRouter(prefix="/api/monitor", tags=["monitor"])


# POST /api/monitor/events  — simulator or any external source posts events here
@router.post("/events")
async def receive_event(
    request: Request,
    event: MonitorEvent,
    db: Session = Depends(get_db),
):
    """
    Entry point for the simulator (or any external source) to push events for
    processing by the backend monitor service.
    """
    sio = getattr(request.app.state, "sio", None)
    rules = await process_event(event, db, sio)
    return {
        "event_id": event.event_id,
        "patient_id": event.patient_id,
        "rules_triggered": rules,
        "count": len(rules),
    }


# GET /api/monitor/status  — returns which checks are currently enabled
@router.get("/status")
def monitor_status():
    settings = get_settings()
    return {
        "checks": {
            "sos": {
                "enabled": settings.check_sos_enabled,
                "implemented": True,
            },
            "geofence": {
                "enabled": settings.check_geofence_enabled,
                "implemented": True,
            },
            "inactive": {
                "enabled": settings.check_inactive_enabled,
                "implemented": False,
            },
            "medication": {
                "enabled": settings.check_medication_enabled,
                "implemented": False,
            },
        }
    }
