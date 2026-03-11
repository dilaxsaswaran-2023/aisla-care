# GPS Location Tracking System

## Overview

The GPS location tracking system allows patients to share their real-time location with caregivers. The system is built with resilience in mind, handling network failures, duplicates, and battery optimization.

## Architecture

### Patient App (Frontend)

**Responsibilities:**
- Capture GPS location every 60 seconds
- Attach timestamp to each location
- Send to backend API
- Queue failed uploads locally
- Retry with exponential backoff (1s, 5s, 15s)
- Batch unsent points for later delivery

**Implementation:**
```typescript
// Enable tracking for current user
const { location, error, isTracking, queuedCount } = useGPSTracking(userId, enabled);
```

**Key Features:**
- **60-second intervals**: Non-continuous polling (battery optimized)
- **Offline queue**: Stores up to 10 failed attempts
- **Exponential backoff**: Prevents hammering API on network issues
- **Automatic retry**: Runs background retry every 2 seconds
- **High accuracy**: Uses `enableHighAccuracy: true` for GPS

### Backend (FastAPI/SQLAlchemy)

**Responsibilities:**
- Receive location updates
- Store current location (1 row per patient)
- Store recent history (last 10 records per patient)
- Ignore duplicate locations (same coords within ~5m)
- Expose endpoints for admin/caregiver queries

**Endpoints:**

1. **POST /api/gps/patient/location**
   - Save a patient's location
   - Request body:
     ```json
     {
       "patient_id": "uuid",
       "latitude": 40.7128,
       "longitude": -74.0060,
       "accuracy": 10.5,
       "captured_at": "2026-03-11T12:30:45Z"
     }
     ```
   - Response:
     ```json
     {
       "success": true,
       "patient_id": "uuid",
       "lat": 40.7128,
       "lng": -74.0060,
       "accuracy": 10.5,
       "stored": true  // false if duplicate
     }
     ```

2. **GET /api/gps/patient/{patient_id}/current**
   - Get current location for a patient
   - Returns latest single location with `updated_at` timestamp

3. **GET /api/gps/patient/{patient_id}/recent**
   - Get recent location history (last 10 records)
   - Ordered by most recent first

### Database Schema

**patient_current_location**
- `patient_id` (UUID, PK)
- `latitude` (float)
- `longitude` (float)
- `accuracy` (float)
- `captured_at` (datetime)
- `updated_at` (datetime)

**patient_location_recent**
- `id` (UUID, PK)
- `patient_id` (UUID, FK)
- `latitude` (float)
- `longitude` (float)
- `accuracy` (float)
- `captured_at` (datetime)
- Index: (patient_id, captured_at)
- Unique: (patient_id, captured_at)

## Usage

### Patient Side

Display the GPS tracking panel in the patient dashboard:

```typescript
import { GPSTrackingPanel } from '@/components/patient/GPSTrackingPanel';

export function PatientDashboard() {
  return (
    <div>
      <GPSTrackingPanel />
    </div>
  );
}
```

**User Flow:**
1. Patient taps toggle to enable tracking
2. Browser requests location permission
3. System captures GPS every 60 seconds
4. Locations sent to backend
5. Queued if offline, retried automatically
6. Status shown with live coordinates

### Caregiver Side

View patient locations in admin/caregiver dashboard:

```typescript
import { PatientLocationModal } from '@/components/caregiver/PatientLocationModal';

// In your patient list or patient details:
<PatientLocationModal
  open={locationModalOpen}
  onOpenChange={setLocationModalOpen}
  patientId={patient.id}
  patientName={patient.full_name}
/>
```

**Features:**
- View current location with coordinates
- See location accuracy (±meters)
- View last 10 locations in history
- Click to open in Google Maps
- Locations update automatically

## Duplicate Detection

The backend automatically ignores duplicate locations using the **Haversine formula**:

```python
# Locations within 5 meters of the last known position are ignored
# This prevents database bloat from stationary patients
```

**Threshold:** 5 meters (configurable in `patient_location_service.py`)

**Response:** Backend returns `"stored": false` for duplicates, allowing frontend to optimize.

## Retry Logic

**Queue Management:**

| Attempt | Backoff | Total Wait |
|---------|---------|-----------|
| 1st     | 1s      | 1s        |
| 2nd     | 5s      | 6s        |
| 3rd     | 15s     | 21s       |
| Discard | -       | After 3x  |

**Process:**
1. Location queued immediately
2. Attempted right away
3. On failure: next attempt after backoff duration
4. Check every 2 seconds for retry eligibility
5. Max 3 retries before logging and dropping

## Network Behavior

**Online:**
- Locations sent immediately
- 0-100ms latency typical
- Status badge shows "Tracking Active"

**Offline/Network Error:**
- Location queued
- Badge shows "N locations queued"
- Automatic retry with backoff
- User informed: "Will retry when network is available"
- Queued items cleared once sent

## Privacy & Permissions

**Browser Permission:**
- Uses HTML5 Geolocation API
- Requires user permission
- Can revoke at any time
- Shows permission request on first toggle

**Data Handling:**
- Timestamps attached server-side
- Only shared with assigned caregivers
- No third-party tracking
- Server-side duplicate filtering

## Configuration

**Patient App** (`useGPSTracking.ts`)
- `LOCATION_INTERVAL`: 60000ms (60 seconds)
- `MAX_RETRIES`: 3
- `RETRY_BACKOFF_MS`: [1000, 5000, 15000]

**Backend** (`patient_location_service.py`)
- Duplicate threshold: 5.0 meters
- Recent history limit: 10 records

## Testing

### Frontend Test
```typescript
// Enable tracking for test user
const { location, queuedCount } = useGPSTracking('test-user-id', true);

// Simulate offline: toggle network in DevTools
// Expect: locations queued, automatic retry
```

### Backend Test
```bash
# Save a location
curl -X POST http://localhost:8000/api/gps/patient/location \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "patient-uuid",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  }'

# Get current location
curl http://localhost:8000/api/gps/patient/patient-uuid/current \
  -H "Authorization: Bearer $TOKEN"

# Get recent locations
curl http://localhost:8000/api/gps/patient/patient-uuid/recent \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### "Can't access property 'toFixed', latitude is undefined"
- Check that backend returns valid coordinates
- Ensure `/api/gps/patient/{id}/current` returns full location object
- PatientLocationModal now handles missing fields gracefully

### Tracking not starting
- Check browser console for geolocation errors
- Verify user granted location permission
- Confirm `user?.id` is set (AuthContext provides it)

### Locations not sending
- Check network tab in DevTools
- Verify `POST /api/gps/patient/location` endpoint is accessible
- Look for queue badge in GPS panel
- Check browser console for error details

### Duplicate detection too aggressive
- Adjust threshold in `patient_location_service.py`
- Current: 5.0 meters
- Increase for more filtering, decrease for more granular tracking

## Future Enhancements

- [ ] Geofence alerts (location boundary checks)
- [ ] Route replay visualization
- [ ] Location sharing with family members
- [ ] Battery usage optimization (longer intervals when low battery)
- [ ] Local storage backup for critical locations
- [ ] WebSocket for real-time updates
- [ ] Export location history as KML/GPX
