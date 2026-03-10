from pydantic import BaseModel, Field
from typing import Dict, Any, Optional


class PatientEvent(BaseModel):
    event_id: str
    timestamp: str
    patient_id: str
    device_id: Optional[str] = None
    source: str
    event_type: str
    severity: str = "low"
    status: str = "success"
    metadata: Dict[str, Any] = Field(default_factory=dict)