from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import threading

from simulator_app.event_store import load_events
from simulator_app.replayer import replay_events, stop_replay

app = FastAPI(title="Budii Event Simulator")

DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"
events_cache: List[Dict[str, Any]] = []

replay_thread: threading.Thread | None = None


class StartReplayRequest(BaseModel):
    backend_url: str = Field(default=DEFAULT_BACKEND_URL)
    interval_seconds: int = Field(default=10, ge=1)
    batch_size: int = Field(default=2, ge=1)


@app.on_event("startup")
def startup_event():
    global events_cache
    events_cache = load_events()


@app.get("/health")
def health():
    return {
        "ok": True,
        "events_loaded": len(events_cache)
    }


@app.get("/events")
def get_events():
    return {
        "count": len(events_cache),
        "events": events_cache
    }


@app.post("/start")
def start_replay(payload: StartReplayRequest):
    global replay_thread

    if not events_cache:
        raise HTTPException(status_code=400, detail="No events loaded")

    if replay_thread and replay_thread.is_alive():
        raise HTTPException(status_code=400, detail="Replay already running")

    replay_thread = threading.Thread(
        target=replay_events,
        args=(
            events_cache,
            payload.backend_url,
            payload.interval_seconds,
            payload.batch_size
        ),
        daemon=True
    )
    replay_thread.start()

    return {
        "ok": True,
        "backend_url": payload.backend_url,
        "interval_seconds": payload.interval_seconds,
        "batch_size": payload.batch_size
    }


@app.post("/stop")
def stop():
    stop_replay()
    return {
        "ok": True,
        "message": "Replay stopped"
    }