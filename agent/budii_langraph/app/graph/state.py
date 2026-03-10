from typing import Any, Optional, Annotated
from typing_extensions import TypedDict
import operator

from models import IncomingEvent


class GraphState(TypedDict, total=False):
    event: IncomingEvent
    patient_id: str

    geofence: Optional[dict]
    medication_schedule: list[dict]
    active_hours: Optional[dict]

    rules_triggered: Annotated[list[dict], operator.add]
    actions: Annotated[list[dict], operator.add]

    triggered: bool
    final_result: dict[str, Any]