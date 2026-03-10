import time
import threading
from typing import List, Dict, Any
from simulator_app.publisher import publish_event

STOP_REPLAY = False


def stop_replay():
    global STOP_REPLAY
    STOP_REPLAY = True


def _send_one_event(backend_url: str, event: Dict[str, Any]) -> None:
    try:
        print(
            f"Sending event_id={event['event_id']} "
            f"patient_id={event['patient_id']} "
            f"timestamp={event['timestamp']}"
        )
        result = publish_event(backend_url, event)
        print(f"Response for {event['event_id']}: {result}")
    except Exception as e:
        print(f"Failed to send event {event.get('event_id')}: {e}")


def replay_events(
    events: List[Dict[str, Any]],
    backend_url: str,
    interval_seconds: int = 10,
    batch_size: int = 2
) -> None:
    global STOP_REPLAY
    STOP_REPLAY = False

    total_events = len(events)

    for i in range(0, total_events, batch_size):
        if STOP_REPLAY:
            print("Replay stopped")
            return

        batch = events[i:i + batch_size]
        print(f"Sending batch of {len(batch)} event(s)...")

        threads = []
        for event in batch:
            t = threading.Thread(
                target=_send_one_event,
                args=(backend_url, event),
                daemon=True
            )
            t.start()
            threads.append(t)

        for t in threads:
            t.join()

        if i + batch_size < total_events:
            time.sleep(interval_seconds)

    print("Replay finished")