from app.database import SessionLocal
from app.services.budii_alert_relationship_service import create_budii_alert_relationships
import uuid

patient_alert_id = uuid.UUID('0b54a72b-5ec7-4389-ae98-507c66db6250')
patient_id = uuid.UUID('157de21d-2fd0-4dc3-8040-579ad5d70192')

if __name__ == '__main__':
    db = SessionLocal()
    try:
        created = create_budii_alert_relationships(db, patient_alert_id, patient_id)
        print('create_budii_alert_relationships returned:', created)
        db.commit()
        # Verify
        from app.models.budii_alert_relationship import BudiiAlertRelationship
        rows = db.query(BudiiAlertRelationship).filter(BudiiAlertRelationship.patient_alert_id == patient_alert_id).all()
        print('BudiiAlertRelationship rows now:', len(rows))
        for r in rows:
            try:
                print(r.to_dict())
            except Exception:
                print('row', r.id, r.patient_alert_id, r.caregiver_id, r.family_id)
    finally:
        db.close()
