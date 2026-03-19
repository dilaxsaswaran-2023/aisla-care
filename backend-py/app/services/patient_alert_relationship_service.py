from app.services.budii_alert_relationship_service import (
    create_budii_alert_relationships,
    get_budii_alert_relationships,
)


def create_patient_alert_relationships(*args, **kwargs):
    return create_budii_alert_relationships(*args, **kwargs)


def get_patient_alert_relationships(*args, **kwargs):
    return get_budii_alert_relationships(*args, **kwargs)


__all__ = ["create_patient_alert_relationships", "get_patient_alert_relationships"]
