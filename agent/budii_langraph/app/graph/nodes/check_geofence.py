import logging
from math import radians, sin, cos, sqrt, atan2

from database.queries import get_geofence, get_current_location

logger = logging.getLogger("budii.graph.geofence")


def haversine_meters(lat1, lon1, lat2, lon2):
    r = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def check_geofence(state):
    event = state["event"]
    patient_id = event.patient_id

    fence = get_geofence(patient_id)
    location = get_current_location(patient_id)

    logger.info(f"[GEOFENCE] event={event.event_id} patient={patient_id}")
    logger.info(f"[GEOFENCE] fence={fence}")
    logger.info(f"[GEOFENCE] location={location}")

    if not fence or not location:
        logger.info(f"[GEOFENCE] skipped patient={patient_id}")
        return {"rules_triggered": []}

    distance = haversine_meters(
        location["lat"],
        location["lng"],
        fence["home_lat"],
        fence["home_lng"],
    )

    logger.info(
        f"[GEOFENCE] patient={patient_id} distance={distance:.2f}m radius={fence['radius_meters']}"
    )

    if distance > fence["radius_meters"]:
        logger.warning(f"[GEOFENCE] breach patient={patient_id}")
        return {
            "rules_triggered": [
                {
                    "triggered": True,
                    "case": "GEOFENCE_BREACH",
                    "action": "SEND_GEOFENCE_ALERT",
                    "reason": "Patient outside home boundary",
                    "context": {
                        "stay_home": False,
                        "distance_meters": round(distance, 2),
                        "captured_at": location.get("captured_at"),
                    },
                }
            ]
        }

    logger.info(f"[GEOFENCE] inside boundary patient={patient_id}")
    return {"rules_triggered": []}