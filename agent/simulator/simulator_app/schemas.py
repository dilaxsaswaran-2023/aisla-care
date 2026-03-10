from typing import Optional, Union, Literal
from pydantic import BaseModel


class MonitoringEvent(BaseModel):
    event_id: str
    patient_id: str
    timestamp: str
    lat: float
    lng: float
    medicine_taken: bool
    movement: bool
    last_sos_triggered_time: Optional[str] = None


class SOSEvent(BaseModel):
    event_id: str
    patient_id: str
    timestamp: str
    sos_triggered: Literal[True]
    sos_triggered_time: str
    last_sos_triggered_time: Optional[str] = None


EventPayload = Union[MonitoringEvent, SOSEvent]