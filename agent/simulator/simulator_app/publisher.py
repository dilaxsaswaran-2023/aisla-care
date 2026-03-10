import requests
from typing import Dict, Any


def publish_event(base_url: str, event: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{base_url.rstrip('/')}/events"
    response = requests.post(url, json=event, timeout=10)
    response.raise_for_status()

    try:
        return response.json()
    except Exception:
        return {
            "status_code": response.status_code,
            "text": response.text
        }