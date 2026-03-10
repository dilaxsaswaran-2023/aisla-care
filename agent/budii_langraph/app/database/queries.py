from database.db import get_connection


def get_geofence(patient_id):
    conn = get_connection()
    row = conn.execute(
        """
        SELECT patient_id, home_lat, home_lng, radius_meters
        FROM patient_geofence
        WHERE patient_id = ?
        """,
        (patient_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_medication_schedule(patient_id):
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, patient_id, medicine_name, scheduled_time, is_active
        FROM medication_schedule
        WHERE patient_id = ? AND is_active = 1
        ORDER BY scheduled_time
        """,
        (patient_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_active_hours(patient_id):
    conn = get_connection()
    row = conn.execute(
        """
        SELECT patient_id, active_start, active_end
        FROM patient_active_hours
        WHERE patient_id = ?
        """,
        (patient_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None