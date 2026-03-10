import json
from pathlib import Path
from typing import List, Dict, Any

BASE_DIR = Path(__file__).resolve().parent
EVENTS_FILE =  "dummy_events.json"


def load_events() -> List[Dict[str, Any]]:
    with open(EVENTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)