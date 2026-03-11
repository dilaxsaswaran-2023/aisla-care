import sys
import logging
from pathlib import Path
import requests

# ---------------------------------------------------------------------------
# Bootstrap: add backend-py to sys.path so shared models/DB can be imported.
# This must run before any local imports that pull from database.db.
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parents[3] / "backend-py"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Load backend-py .env BEFORE importing any backend-py modules so that
# pydantic-settings picks up DATABASE_URL / Twilio creds correctly
# regardless of the working directory the agent is started from.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=True)

from fastapi import FastAPI
import uvicorn

from models import IncomingEvent
from database.db import init_db
from graph.builder import build_graph

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

logger = logging.getLogger("budii.main")

app = FastAPI()
graph = build_graph()


@app.on_event("startup")
def startup_event():
    logger.info("[MAIN] Initializing database")
    init_db()


# @app.post("/events")
# def receive_event(event: IncomingEvent):
    # logger.info(f"[MAIN] Received event={event.event_id}")

    # result_state = graph.invoke({"event": event})

    # return {
    #     "event_id": event.event_id,
    #     "patient_id": event.patient_id,
    #     "result": result_state.get("final_result", {
    #         "triggered": False,
    #         "rules_triggered": []
    #     }),
    #     "actions": result_state.get("actions", [])
    # }
import requests

@app.post("/events")
def receive_event(event: IncomingEvent):
    logger.info(f"[MAIN] Received event={event.event_id}")
    logger.info(f"[MAIN]  {event}")

    result_state = graph.invoke({"event": event})

    payload = {
        "event_id": event.event_id,
        "patient_id": event.patient_id,
        "result": result_state.get("final_result", {
            "triggered": False,
            "rules_triggered": []
        }),
        "actions": result_state.get("actions", [])
    }
    logger.info(f"payload:{payload}")
    actions = payload.get("actions", [])

    if actions:
        try:
            response = requests.post(
                "http://127.0.0.1:5030/api/internal/budii-alert",
                json=payload,
                headers={"X-Internal-Key": "budii-secret-123"},
                timeout=5
            )
            logger.info(
                f"[MAIN] Forwarded {len(actions)} action(s) to main backend "
                f"status={response.status_code} event={event.event_id}"
            )
        except Exception as e:
            logger.error(f"[MAIN] Failed to forward alert payload: {e}")
    else:
        logger.info(f"[MAIN] No actions to forward for event={event.event_id}")

    return payload


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

    