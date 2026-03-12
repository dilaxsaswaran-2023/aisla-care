import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.relationship import Relationship
from app.models.user import User
from app.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/api/relationships", tags=["relationships"])


# GET /api/relationships
@router.get("/")
def list_relationships(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = current_user["role"]
    user_id = current_user["userId"]
    relationships = []

    if role == "super_admin":
        caregivers = db.query(User).filter(User.role == "caregiver").all()
        for cg in caregivers:
            patients = db.query(User).filter(User.caregiver_id == cg.id).all()
            patients_list = []
            for p in patients:
                fam = []
                if p.family_ids:
                    fam = db.query(User).filter(User.id.in_(p.family_ids)).all()
                patients_list.append({
                    "patient": {"_id": str(p.id), "full_name": p.full_name, "email": p.email},
                    "family_members": [{"_id": str(f.id), "full_name": f.full_name, "email": f.email, "role": f.role} for f in fam],
                })
            relationships.append({
                "caregiver": {"_id": str(cg.id), "full_name": cg.full_name, "email": cg.email, "corporate_id": str(cg.corporate_id) if cg.corporate_id else None},
                "patients": patients_list,
            })

    elif role == "admin":
        caregivers = db.query(User).filter(User.role == "caregiver", User.corporate_id == uuid.UUID(user_id)).all()
        for cg in caregivers:
            patients = db.query(User).filter(User.caregiver_id == cg.id).all()
            patients_list = []
            for p in patients:
                fam = db.query(User).filter(User.id.in_(p.family_ids)).all() if p.family_ids else []
                patients_list.append({
                    "patient": {"_id": str(p.id), "full_name": p.full_name, "email": p.email},
                    "family_members": [{"_id": str(f.id), "full_name": f.full_name, "email": f.email, "role": f.role} for f in fam],
                })
            relationships.append({
                "caregiver": {"_id": str(cg.id), "full_name": cg.full_name, "email": cg.email},
                "patients": patients_list,
            })

    elif role == "caregiver":
        cg = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        patients = db.query(User).filter(User.caregiver_id == uuid.UUID(user_id)).all()
        patients_list = []
        for p in patients:
            fam = db.query(User).filter(User.id.in_(p.family_ids)).all() if p.family_ids else []
            patients_list.append({
                "patient": {"_id": str(p.id), "full_name": p.full_name, "email": p.email},
                "family_members": [{"_id": str(f.id), "full_name": f.full_name, "email": f.email, "role": f.role} for f in fam],
            })
        relationships.append({
            "caregiver": {"_id": str(cg.id), "full_name": cg.full_name, "email": cg.email} if cg else {},
            "patients": patients_list,
        })

    elif role == "patient":
        pt = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if pt and pt.caregiver_id:
            cg = db.query(User).filter(User.id == pt.caregiver_id).first()
            fam = db.query(User).filter(User.id.in_(pt.family_ids)).all() if pt.family_ids else []
            relationships.append({
                "caregiver": {"_id": str(cg.id), "full_name": cg.full_name, "email": cg.email} if cg else {},
                "patients": [{
                    "patient": {"_id": str(pt.id), "full_name": pt.full_name, "email": pt.email},
                    "family_members": [{"_id": str(f.id), "full_name": f.full_name, "email": f.email, "role": f.role} for f in fam],
                }],
            })

    elif role == "family":
        from app.models.relationship import Relationship as RelModel
        fam_rels = (
            db.query(RelModel)
            .filter(
                RelModel.related_user_id == uuid.UUID(user_id),
                RelModel.relationship_type == "family",
            )
            .all()
        )
        for rel in fam_rels:
            pt = db.query(User).filter(User.id == rel.patient_id).first()
            if not pt:
                continue
            cg = db.query(User).filter(User.id == pt.caregiver_id).first() if pt.caregiver_id else None
            relationships.append({
                "caregiver": {"_id": str(cg.id), "full_name": cg.full_name, "email": cg.email} if cg else {},
                "patients": [{
                    "patient": {"_id": str(pt.id), "full_name": pt.full_name, "email": pt.email},
                    "family_members": [],
                }],
            })

    return relationships


# POST /api/relationships
@router.post("/", status_code=201)
def create_relationship(
    body: dict,
    current_user: dict = Depends(RoleChecker(["admin", "caregiver"])),
    db: Session = Depends(get_db),
):
    patient_id = uuid.UUID(body["patient_id"])
    related_user_id = uuid.UUID(body["related_user_id"])

    existing = db.query(Relationship).filter(
        Relationship.patient_id == patient_id,
        Relationship.related_user_id == related_user_id,
    ).first()
    if existing:
        raise HTTPException(400, "Relationship already exists")

    rel = Relationship(
        patient_id=patient_id,
        related_user_id=related_user_id,
        relationship_type=body["relationship_type"],
        created_by=uuid.UUID(current_user["userId"]),
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel.to_dict()


# DELETE /api/relationships/:id
@router.delete("/{rel_id}")
def delete_relationship(
    rel_id: str,
    current_user: dict = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db),
):
    rel = db.query(Relationship).filter(Relationship.id == uuid.UUID(rel_id)).first()
    if not rel:
        raise HTTPException(404, "Relationship not found")
    db.delete(rel)
    db.commit()
    return {"success": True}
