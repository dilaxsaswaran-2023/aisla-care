import json
from datetime import datetime
from database.db import get_connection


def save_rule_result(event, result):

    conn = get_connection()

    conn.execute(
        """
        INSERT INTO processed_events (
            event_id,
            patient_id,
            timestamp,
            result_json,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            event.event_id,
            event.patient_id,
            event.timestamp,
            json.dumps(result),
            datetime.utcnow().isoformat()
        )
    )

    conn.commit()
    conn.close()