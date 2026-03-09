"""Geofencing utility functions for patient monitoring."""
from math import radians, cos, sin, asin, sqrt
from typing import Optional, Tuple
from datetime import datetime, timedelta


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    
    Args:
        lat1, lon1: First location (latitude, longitude in degrees)
        lat2, lon2: Second location (latitude, longitude in degrees)
    
    Returns:
        Distance in meters
    """
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    
    # Radius of Earth in meters
    r = 6371000
    return c * r


def is_within_boundary(
    current_lat: float,
    current_lon: float,
    boundary_lat: float,
    boundary_lon: float,
    boundary_radius_meters: float,
    accuracy_meters: float = 0,
) -> bool:
    """
    Check if a location is within a circular geofence boundary.
    
    Args:
        current_lat, current_lon: Patient's current location
        boundary_lat, boundary_lon: Center of safe zone
        boundary_radius_meters: Radius of safe zone in meters
        accuracy_meters: GPS accuracy (will be added as buffer)
    
    Returns:
        True if within boundary, False if outside
    """
    distance = haversine_distance(current_lat, current_lon, boundary_lat, boundary_lon)
    # Add accuracy buffer for more accurate boundary checking
    return distance <= (boundary_radius_meters + accuracy_meters)


def evaluate_geofence_state(
    current_lat: float,
    current_lon: float,
    boundary_lat: float,
    boundary_lon: float,
    boundary_radius_meters: float,
    accuracy_meters: float = 10.0,
    previous_state: str = "inside",
    outside_sample_count: int = 0,
) -> Tuple[str, int, bool, bool]:
    """
    Evaluate geofence state with anti-false-alert logic.
    
    Uses a confirmed exit pattern:
    - inside → outside_candidate (upon boundary exit)
    - outside_candidate → outside_confirmed (after 3 samples or 60s)
    
    Args:
        current_lat, current_lon: Patient's current location
        boundary_lat, boundary_lon: Center of safe zone
        boundary_radius_meters: Radius of safe zone in meters
        accuracy_meters: GPS accuracy in meters (default 10m)
        previous_state: Previous geofence state
        outside_sample_count: Count of consecutive outside samples
    
    Returns:
        Tuple of (state, outsideCount, shouldAlert, shouldReEnter)
        - state: "inside", "outside_candidate", or "outside_confirmed"
        - outsideCount: Number of consecutive outside samples
        - shouldAlert: True if exit should be reported to caregiver
        - shouldReEnter: True if re-entry should be reported
    """
    distance = haversine_distance(current_lat, current_lon, boundary_lat, boundary_lon)
    buffer = max(20.0, accuracy_meters)  # Minimum 20m buffer for noisy GPS
    threshold = boundary_radius_meters + buffer
    
    # Patient is inside the boundary
    if distance <= boundary_radius_meters:
        should_re_enter = previous_state == "outside_confirmed"
        return ("inside", 0, False, should_re_enter)
    
    # Patient is outside the threshold (confirmed outside)
    if distance > threshold:
        new_count = outside_sample_count + 1
        
        # After 3+ samples, confirm the exit
        if new_count >= 3 and previous_state != "outside_confirmed":
            return ("outside_confirmed", new_count, True, False)
        
        # Still building sample count (candidate state)
        return ("outside_candidate", new_count, False, False)
    
    # Patient is in the buffer zone (noisy GPS near boundary)
    return (previous_state, outside_sample_count, False, False)


class GeofenceState:
    """Tracks the state of a patient's geofence monitoring."""
    
    def __init__(
        self,
        patient_id: str,
        boundary_lat: float,
        boundary_lon: float,
        boundary_radius: float,
    ):
        self.patient_id = patient_id
        self.boundary_lat = boundary_lat
        self.boundary_lon = boundary_lon
        self.boundary_radius = boundary_radius
        
        self.state = "inside"  # inside | outside_candidate | outside_confirmed
        self.outside_sample_count = 0
        self.last_alert_time: Optional[datetime] = None
        self.last_re_entry_time: Optional[datetime] = None
    
    def check_location(
        self,
        current_lat: float,
        current_lon: float,
        accuracy_meters: float = 10.0,
    ) -> Tuple[bool, bool]:
        """
        Check location against geofence.
        
        Returns:
            Tuple of (should_send_exit_alert, should_send_re_entry_alert)
        """
        new_state, count, should_alert, should_re_enter = evaluate_geofence_state(
            current_lat=current_lat,
            current_lon=current_lon,
            boundary_lat=self.boundary_lat,
            boundary_lon=self.boundary_lon,
            boundary_radius_meters=self.boundary_radius,
            accuracy_meters=accuracy_meters,
            previous_state=self.state,
            outside_sample_count=self.outside_sample_count,
        )
        
        self.state = new_state
        self.outside_sample_count = count
        
        # Deduplicate alerts: don't spam same alert within 5 minutes
        exit_alert = False
        if should_alert and (
            self.last_alert_time is None or
            datetime.utcnow() - self.last_alert_time > timedelta(minutes=5)
        ):
            exit_alert = True
            self.last_alert_time = datetime.utcnow()
        
        re_entry_alert = False
        if should_re_enter and (
            self.last_re_entry_time is None or
            datetime.utcnow() - self.last_re_entry_time > timedelta(minutes=5)
        ):
            re_entry_alert = True
            self.last_re_entry_time = datetime.utcnow()
        
        return (exit_alert, re_entry_alert)
