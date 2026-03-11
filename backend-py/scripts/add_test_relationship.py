from app.database import SessionLocal
from app.models.relationship import Relationship
import uuid

patient_id = uuid.UUID('157de21d-2fd0-4dc3-8040-579ad5d70192')
related_user_id = uuid.UUID('0c851977-543e-4936-a97a-095661e824c8')

if __name__ == '__main__':
    db = SessionLocal()
    try:
        # Check if exists
        exists = db.query(Relationship).filter(
            Relationship.patient_id == patient_id,
            Relationship.related_user_id == related_user_id
        ).first()
        if exists:
            print('Relationship already exists:', exists.to_dict())
        else:
            rel = Relationship(
                patient_id=patient_id,
                related_user_id=related_user_id,
                relationship_type='caregiver'
            )
            db.add(rel)
            db.commit()
            db.refresh(rel)
            print('Inserted relationship:', rel.to_dict())
    finally:
        db.close()
