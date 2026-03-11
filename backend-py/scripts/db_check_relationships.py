from app.database import SessionLocal
from app.models.relationship import Relationship
from app.models.budii_alert_relationship import BudiiAlertRelationship

patient_id = '157de21d-2fd0-4dc3-8040-579ad5d70192'
patient_alert_id = '0b54a72b-5ec7-4389-ae98-507c66db6250'

if __name__ == '__main__':
    db = SessionLocal()
    try:
        rels = db.query(Relationship).filter(Relationship.patient_id == patient_id).all()
        print('Relationships found for patient:', len(rels))
        for r in rels:
            print(r.to_dict())

        brels = db.query(BudiiAlertRelationship).filter(BudiiAlertRelationship.patient_alert_id == patient_alert_id).all()
        print('BudiiAlertRelationship rows for patient_alert:', len(brels))
        for br in brels:
            try:
                print(br.to_dict())
            except Exception:
                print('BudiiAlertRelationship', getattr(br,'id',None), getattr(br,'patient_alert_id',None), getattr(br,'caregiver_id',None), getattr(br,'family_id',None))
    finally:
        db.close()
