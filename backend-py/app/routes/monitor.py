import logging

from fastapi import APIRouter

from app.config import get_settings

logger = logging.getLogger("monitor.router")
router = APIRouter(prefix="/api/monitor", tags=["monitor"])


# GET /api/monitor/status  — returns which checks are currently enabled
@router.get("/status")
def monitor_status():
    """
    Returns the status of all monitoring checks.
    
    - SOS: Event-driven via /api/alerts/sos endpoint
    - Geofence: Scheduled independently every 60 seconds
    - Inactive: Not yet implemented
    - Medication: Scheduled independently every 30 minutes
    """
    settings = get_settings()
    return {
        "checks": {
            "sos": {
                "enabled": settings.check_sos_enabled,
                "implemented": True,
                "mode": "event-driven",
                "description": "Triggered when user hits SOS button",
            },
            "geofence": {
                "enabled": settings.check_geofence_enabled,
                "implemented": True,
                "mode": "scheduled",
                "interval_seconds": 60,
                "description": "Runs every minute for all patients with geofencing enabled",
            },
            "inactive": {
                "enabled": settings.check_inactive_enabled,
                "implemented": False,
                "mode": "not-yet-implemented",
            },
            "medication": {
                "enabled": settings.check_medication_enabled,
                "implemented": True,
                "mode": "scheduled",
                "interval_seconds": 1800,
                "description": "Runs every 30 minutes for active medication schedules",
            },
        }
    }
