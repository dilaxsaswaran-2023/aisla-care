import sqlite3
from pathlib import Path

DB_PATH = Path("data/budii.db")


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS patient_geofence (
            patient_id TEXT PRIMARY KEY,
            home_lat REAL NOT NULL,
            home_lng REAL NOT NULL,
            radius_meters REAL NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS medication_schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            medicine_name TEXT NOT NULL,
            scheduled_time TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS patient_active_hours (
            patient_id TEXT PRIMARY KEY,
            active_start TEXT NOT NULL,
            active_end TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS processed_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT,
            patient_id TEXT,
            timestamp TEXT,
            result_json TEXT,
            created_at TEXT
        )
    """)

    # -----------------------------
    # Seed sample data
    # -----------------------------

    # Geofence
    conn.execute("""
        INSERT OR IGNORE INTO patient_geofence
        (patient_id, home_lat, home_lng, radius_meters)
        VALUES
        ('patient_001', 6.9271, 79.8612, 150),
        ('patient_002', 6.9275, 79.8615, 150)
    """)

    # Medication schedule
    conn.execute("""
        INSERT OR IGNORE INTO medication_schedule
        (patient_id, medicine_name, scheduled_time)
        VALUES
        ('patient_001', 'Blood Pressure Tablet', '08:00'),
        ('patient_001', 'Vitamin D', '20:00'),
        ('patient_002', 'Diabetes Tablet', '09:00')
    """)

    # Active hours
    conn.execute("""
        INSERT OR IGNORE INTO patient_active_hours
        (patient_id, active_start, active_end)
        VALUES
        ('patient_001', '06:00', '22:00'),
        ('patient_002', '07:00', '21:00')
    """)

    conn.commit()
    conn.close()