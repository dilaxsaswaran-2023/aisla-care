# Monitoring Architecture

This document describes the independent monitoring system for AISLA Care.

## Architecture Overview

The monitoring system now uses **independent, specialized checks** rather than a monolithic event processor. Each check runs in its own mode: event-driven, scheduled, or on-demand.

```
┌─────────────────────────────────────────────────────────────┐
│                    AISLA Care Backend                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐        ┌──────────────────────┐   │
│  │   SOS Check          │        │ Geofence Scheduler   │   │
│  │  (Event-Driven)      │        │  (Scheduled: 60s)    │   │
│  └──────────────────────┘        └──────────────────────┘   │
│           ▲                               ▲                  │
│           │                               │                  │
│  ┌────────┴────────┐          ┌──────────┴──────────┐       │
│  │POST /api/alerts/sos         │APScheduler Runs     │       │
│  │Patient SOS button           │Every 60 seconds     │       │
│  └─────────────────────────────────────────────────┘       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Database (PostgreSQL)                         │   │
│  │  - users (patient geofence config)                   │   │
│  │  - patient_current_location (latest location)        │   │
│  │  - alerts (frontend-visible)                         │   │
│  │  - patient_alerts (audit log)                        │   │
│  │  - alert_relationships (caregiver links)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Check Modes

### 1. SOS Check (Event-Driven) ✅ Implemented

**Trigger:** User presses emergency SOS button → `POST /api/alerts/sos`  
**Frequency:** On-demand (when triggered)  
**Implementation:** `app/routes/alerts.py` → `check_sos_direct()`

**Flow:**
1. Patient calls `/api/alerts/sos` endpoint with optional voice transcription
2. Backend creates `Alert` record (alert_type="sos", priority="critical")
3. Directly calls `check_sos_direct()` helper to determine if it's:
   - **SOS_TRIGGER**: First SOS or last SOS > 8 minutes ago → `action: SEND_CONFIRMATION`
   - **SOS_REPEAT**: Repeated SOS within 8 minutes → `action: START_EMERGENCY`
4. Creates `alert_relationships` to notify caregivers/family
5. Emits socket event `new_alert` with SOS result
6. Returns response with `sos_result` in payload

**Code location:** [app/routes/alerts.py](../backend-py/app/routes/alerts.py#L180-L245)

---

### 2. Geofence Check (Scheduled) ✅ Implemented

**Trigger:** Background scheduler  
**Frequency:** Every 60 seconds (independent of events)  
**Implementation:** `app/services/geofence_scheduler.py`

**Flow:**
1. Background scheduler wakes up every 60 seconds
2. Queries all users with `role="patient"` AND `is_geofencing=true`
3. For each patient:
   - Fetches current location from `PatientCurrentLocation` table
   - Creates synthetic `MonitorEvent` with location data
   - Calls `check_geofence(event, db)` to check if outside boundary
4. If breach detected (outside home radius):
   - Updates `user.geofence_last_alert` timestamp
   - Applies 10-minute cooldown (prevents alert spam)
   - Creates `Alert` record (alert_type="geofence", priority="high")
   - Creates `PatientAlert` audit record with source="scheduler"
   - Creates relationships to notify caregivers/family
5. Commits DB changes and continues

**Code location:** [app/services/geofence_scheduler.py](../backend-py/app/services/geofence_scheduler.py)

---

### 3. Inactive Check (Not Yet Implemented) ❌

**Status:** Stub with no logic  
**File:** `app/services/monitor/checks/check_inactive.py`

To implement:
- Define what "inactive" means (e.g., no GPS movement for X minutes)
- Decide on check mode: scheduled or event-driven?
- Create service/scheduler as needed

---

### 4. Medication Check (Not Yet Implemented) ❌

**Status:** Stub with no logic  
**File:** `app/services/monitor/checks/check_medication.py`

To implement:
- Define medication tracking logic (missed doses, schedule reminders)
- Decide on check mode: scheduled or event-driven?
- Create service/scheduler as needed

---

## Endpoints

### `GET /api/monitor/status`
Returns the current status and mode of all checks.

**Response:**
```json
{
  "checks": {
    "sos": {
      "enabled": true,
      "implemented": true,
      "mode": "event-driven",
      "description": "Triggered when user hits SOS button"
    },
    "geofence": {
      "enabled": true,
      "implemented": true,
      "mode": "scheduled",
      "interval_seconds": 60,
      "description": "Runs every minute for all patients with geofencing enabled"
    },
    "inactive": {
      "enabled": false,
      "implemented": false,
      "mode": "not-yet-implemented"
    },
    "medication": {
      "enabled": false,
      "implemented": false,
      "mode": "not-yet-implemented"
    }
  }
}
```

### `POST /api/alerts/sos`
Triggers an SOS alert and runs the SOS check.

**Request:**
```json
{
  "message": "Help needed",
  "voice_transcription": "..."
}
```

**Response:**
```json
{
  "id": "...",
  "patient_id": "...",
  "alert_type": "sos",
  "status": "active",
  "title": "SOS Emergency Alert",
  "relationships": [...],
  "sos_result": {
    "triggered": true,
    "case": "SOS_TRIGGER",
    "action": "SEND_CONFIRMATION",
    "reason": "SOS triggered"
  }
}
```

---

## Data Models

### Alert
Frontend-visible alert created by monitoring checks. Links patients to caregivers/family.
- `alert_type`: "sos" | "geofence" | "health" | "inactivity"
- `status`: "active" | "resolved"
- `priority`: "critical" | "high" | "medium" | "low"

### PatientAlert
Audit log entry for every alert event. Used for patient personal history.
- `source`: "monitor" | "scheduler" | "manual"
- `case`: The specific rule that triggered (e.g., "SOS_TRIGGER", "GEOFENCE_BREACH")
- Immutable once created

### AlertRelationship
Links an `Alert` to caregivers/family members so they see it in their alerts list. Auto-populated based on patient's relationships.

---

## Configuration

**Enable/disable checks via environment variables:**
```env
CHECK_SOS_ENABLED=true
CHECK_GEOFENCE_ENABLED=true
CHECK_INACTIVE_ENABLED=false
CHECK_MEDICATION_ENABLED=false
```

**Geofence scheduler interval:**  
Currently hardcoded to 60 seconds in `geofence_scheduler.py` → `scheduler.add_job(..., seconds=60)`  
Can be made configurable if needed.

**Geofence cooldown:**  
Currently hardcoded to 10 minutes in `check_geofence.py` → `GEOFENCE_COOLDOWN_MINUTES = 10`  
Prevents alert spam if patient briefly leaves and re-enters.

---

## Deprecated Components

### `process_event()` function
Previously used to batch all checks together. Now replaced by independent check modes.
- **Removed from exports:** `app/services/monitor/__init__.py`
- **Still exists but deprecated:** `app/services/monitor/service.py` (kept for backward compatibility)

### `POST /api/monitor/events` endpoint
Was a simulator endpoint for testing. No longer needed since checks are now independent.
- **Removed from:** `app/routes/monitor.py`

---

## Adding New Checks

To add a new independent check (e.g., Medication):

1. **Create the check function:**
   ```python
   # app/services/monitor/checks/check_medication.py
   def check_medication(event: MonitorEvent, db: Session) -> list:
       """Return list of triggered rules."""
       rules = []
       # ... logic ...
       return rules
   ```

2. **Choose a mode:**
   - **Event-driven?** Call directly from a route (like SOS)
   - **Scheduled?** Create a scheduler similar to `geofence_scheduler.py`

3. **Create relationships & alerts if needed:**
   ```python
   alert = Alert(patient_id=..., alert_type="medication", ...)
   create_alert_relationships(db, alert.id, patient_id)
   ```

4. **Add to config** if it should be toggleable:
   ```python
   check_medication_enabled: bool = True  # in app/config.py
   ```

---

## Monitoring & Logs

### Log Prefixes
- `[SOS]` or `[SOS_CHECK]` - SOS check events
- `[GEOFENCE]` or `[GEOFENCE_SCHEDULER]` - Geofence check events
- `[MONITOR]` - Legacy (deprecated process_event)

### Example SOS Logs
```
[SOS] evaluating event=abc-123
[SOS] seconds since last SOS: 500
[SOS_CHECK] SOS_REPEAT - within 8 minutes
```

### Example Geofence Logs
```
[GEOFENCE_SCHEDULER] Checking 5 patients
[GEOFENCE] patient=xyz-789 distance=1250.50m radius=500m
[GEOFENCE] breach detected patient=xyz-789
[GEOFENCE_SCHEDULER] Created geofence breach alert for patient xyz-789
```

---

## Future Improvements

1. **Make scheduler interval configurable:** Move from hardcoded 60s to environment variable
2. **Implement inactive check:** Track movement/inactivity patterns
3. **Implement medication check:** Track medication schedules and adherence
4. **Add check health endpoints:** `/api/monitor/checks/{check_name}/health`
5. **Metrics & telemetry:** Track check execution times, failure rates
6. **Dead letter queue:** Store failed alerts for replay/retry
