import logging
from math import radians, sin, cos, sqrt, atan2

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
    fence = state.get("geofence")

    if not fence or event.lat is None or event.lng is None:
        logger.info(f"[GEOFENCE] skipped event={event.event_id}")
        return {"rules_triggered": []}

    distance = haversine_meters(
        event.lat, event.lng,
        fence["home_lat"], fence["home_lng"]
    )

    if distance > fence["radius_meters"]:
        logger.warning(f"[GEOFENCE] breach event={event.event_id}")
        return {
            "rules_triggered": [{
                "triggered": True,
                "case": "GEOFENCE_BREACH",
                "action": "SEND_GEOFENCE_ALERT",
                "reason": "Patient outside home boundary",
                "context": {
                    "stay_home": False,
                    "distance_meters": round(distance, 2)
                }
            }]
        }

    return {"rules_triggered": []}