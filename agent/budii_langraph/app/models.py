from pydantic import BaseModel
from typing import Optional


class IncomingEvent(BaseModel):

    event_id: str
    patient_id: str
    timestamp: str

    lat: Optional[float] = None
    lng: Optional[float] = None

    medicine_taken: Optional[bool] = None
    movement: Optional[bool] = None

    sos_triggered: Optional[bool] = None
    sos_triggered_time: Optional[str] = None
    last_sos_triggered_time: Optional[str] = None