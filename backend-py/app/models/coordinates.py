"""Coordinates utility model for geographic locations."""
from typing import Optional
from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    """Represents a geographic location with latitude and longitude."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in degrees")

    class Config:
        json_schema_extra = {
            "example": {
                "latitude": 40.7128,
                "longitude": -74.0060
            }
        }
