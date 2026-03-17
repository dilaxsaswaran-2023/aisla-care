import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from passlib.context import CryptContext

from app.database import get_db
from app.models.user import User
from app.models.relationship import Relationship
from app.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/api/users", tags=["users"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CREATABLE_ROLES = {
    "super_admin": ["admin", "caregiver", "patient", "family"],
    "admin": ["caregiver", "patient", "family"],
    "caregiver": ["patient", "family"],
}


# ─── GET /api/users ──────────────────────────────────────────────────────────
@router.get("/")
def list_users(
    current_user: dict = Depends(RoleChecker(["super_admin", "admin", "caregiver"])),
    db: Session = Depends(get_db),
):
    role = current_user["role"]
    user_id = current_user["userId"]
    query = db.query(User)

    if role == "super_admin":
        pass  # see all
    elif role == "admin":
        query = query.filter(User.corporate_id == uuid.UUID(user_id))
    elif role == "caregiver":
        caregiver_uuid = uuid.UUID(user_id)
        query = query.filter(
            or_(
                User.caregiver_id == caregiver_uuid,
                text(f"caregiver_ids @> ARRAY['{caregiver_uuid}']::uuid[]"),
            )
        )

    users = query.order_by(User.created_at.desc()).all()
    return [u.to_dict() for u in users]


# ─── GET /api/users/caregivers-list ──────────────────────────────────────────
@router.get("/caregivers-list")
def caregivers_list(
    search: str = Query(""),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.role == "caregiver")
    if current_user["role"] != "super_admin":
        query = query.filter(User.corporate_id == uuid.UUID(current_user["userId"]))
    if search:
        query = query.filter(or_(
            User.full_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        ))
    caregivers = query.order_by(User.full_name).all()
    return [{"_id": str(c.id), "email": c.email, "full_name": c.full_name} for c in caregivers]


# ─── GET /api/users/patients-list ────────────────────────────────────────────
@router.get("/patients-list")
def patients_list(
    search: str = Query(""),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.role == "patient")
    if current_user["role"] != "super_admin":
        query = query.filter(User.corporate_id == uuid.UUID(current_user["userId"]))
    if search:
        query = query.filter(or_(
            User.full_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        ))
    patients = query.order_by(User.full_name).all()
    return [{"_id": str(p.id), "email": p.email, "full_name": p.full_name} for p in patients]


# ─── GET /api/users/family-list ──────────────────────────────────────────────
@router.get("/family-list")
def family_list(
    search: str = Query(""),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(User.role == "family")
    if current_user["role"] != "super_admin":
        query = query.filter(User.corporate_id == uuid.UUID(current_user["userId"]))
    if search:
        query = query.filter(or_(
            User.full_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        ))
    families = query.order_by(User.full_name).all()
    return [{"_id": str(f.id), "email": f.email, "full_name": f.full_name} for f in families]


# ─── GET /api/users/patients ────────────────────────────────────────────────
@router.get("/patients")
def get_patients(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    role = current_user["role"]
    
    # Get patients based on user role
    if role == "caregiver":
        # Caregiver: get all patients assigned to this caregiver (single or multi)
        patients = db.query(User).filter(
            User.role == "patient",
            or_(
                User.caregiver_id == user_id,
                text(f"caregiver_ids @> ARRAY['{user_id}']::uuid[]"),
            )
        ).all()
    elif role == "family":
        # Family member: get all patients where this family member is in family_ids
        # Use PostgreSQL @> operator to check if family_ids array contains the user_id
        patients = db.query(User).filter(
            User.role == "patient",
            text(f"family_ids @> ARRAY['{user_id}']::uuid[]")
        ).all()
    else:
        # Other roles (admin, super_admin) cannot access patients via this endpoint
        raise HTTPException(status_code=403, detail="Only caregivers and family members can access patient data")

    patient_ids = [p.id for p in patients]

    # Only fetch related family members if the caller is a caregiver.
    family_result = []
    caregivers_result = []
    if role == "caregiver":
        # Family members linked to the caregiver's patients
        family_rels = db.query(Relationship).filter(
            Relationship.patient_id.in_(patient_ids),
            Relationship.relationship_type == "family",
        ).all() if patient_ids else []

        # Build mapping: family_member_id → patient_name
        patient_map = {p.id: p.full_name for p in patients}
        fm_to_patient: dict[str, str] = {}
        for rel in family_rels:
            fm_to_patient[str(rel.related_user_id)] = patient_map.get(rel.patient_id, "Patient")

        family_ids = list({r.related_user_id for r in family_rels})
        family_members = db.query(User).filter(User.id.in_(family_ids)).all() if family_ids else []

        for f in family_members:
            fd = f.to_dict()
            fd["patient_name"] = fm_to_patient.get(str(f.id), "")
            family_result.append(fd)
    elif role == "family":
        # For family callers, include caregivers for all their visible patients.
        caregiver_ids = set()
        for p in patients:
            if p.caregiver_id:
                caregiver_ids.add(p.caregiver_id)
            if p.caregiver_ids:
                caregiver_ids.update(p.caregiver_ids)

        caregivers = db.query(User).filter(User.id.in_(list(caregiver_ids))).all() if caregiver_ids else []
        caregivers_result = [c.to_dict() for c in caregivers]

    return {
        "patients": [p.to_dict() for p in patients],
        "familyMembers": family_result,
        "caregivers": caregivers_result,
    }


# ─── GET /api/users/contacts ────────────────────────────────────────────────
@router.get("/contacts")
def get_contacts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = uuid.UUID(current_user["userId"])
    role = current_user["role"]

    contacts = []

    if role == "caregiver":
        patients = db.query(User).filter(
            User.role == "patient",
            or_(
                User.caregiver_id == user_id,
                text(f"caregiver_ids @> ARRAY['{user_id}']::uuid[]"),
            ),
        ).all()

        patient_ids = [p.id for p in patients]

        family_rels = db.query(Relationship).filter(
            Relationship.patient_id.in_(patient_ids),
            Relationship.relationship_type == "family",
        ).all() if patient_ids else []

        patient_map = {p.id: p.full_name for p in patients}
        family_to_patient_name: dict[str, str] = {}
        for rel in family_rels:
            family_to_patient_name[str(rel.related_user_id)] = patient_map.get(rel.patient_id, "Patient")

        family_ids = list({r.related_user_id for r in family_rels})
        family_members = db.query(User).filter(User.id.in_(family_ids)).all() if family_ids else []

        for p in patients:
            contacts.append({
                "id": str(p.id),
                "name": p.full_name,
                "role": "patient",
                "patient_name": None,
            })

        for f in family_members:
            contacts.append({
                "id": str(f.id),
                "name": f.full_name,
                "role": "family",
                "patient_name": family_to_patient_name.get(str(f.id), ""),
            })

    elif role == "family":
        patients = db.query(User).filter(
            User.role == "patient",
            text(f"family_ids @> ARRAY['{user_id}']::uuid[]"),
        ).all()

        patient_ids = [p.id for p in patients]

        # Get caregivers of those patients
        caregiver_ids = set()
        for p in patients:
            if p.caregiver_id:
                caregiver_ids.add(p.caregiver_id)
            if p.caregiver_ids:
                caregiver_ids.update(p.caregiver_ids)

        caregivers = db.query(User).filter(User.id.in_(list(caregiver_ids))).all() if caregiver_ids else []

        # Get family members linked to those patients
        family_rels = db.query(Relationship).filter(
            Relationship.patient_id.in_(patient_ids),
            Relationship.relationship_type == "family",
        ).all() if patient_ids else []

        family_member_ids = list({r.related_user_id for r in family_rels})
        family_members = db.query(User).filter(User.id.in_(family_member_ids)).all() if family_member_ids else []

        for p in patients:
            contacts.append({
                "id": str(p.id),
                "name": p.full_name,
                "role": "patient",
                "patient_name": None,
            })

        for c in caregivers:
            contacts.append({
                "id": str(c.id),
                "name": c.full_name,
                "role": "caregiver",
                "patient_name": None,
            })

        for f in family_members:
            contacts.append({
                "id": str(f.id),
                "name": f.full_name,
                "role": "family",
                "patient_name": None,
            })

    else:
        raise HTTPException(status_code=403, detail="Only caregivers and family members can access contacts")

    # Deduplicate by id while preserving insertion order.
    deduped = []
    seen_ids = set()
    for c in contacts:
        if c["id"] in seen_ids:
            continue
        seen_ids.add(c["id"])
        deduped.append(c)

    return deduped


# ─── GET /api/users/{user_id} ───────────────────────────────────────────────
@router.get("/{user_id}")
def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        target_id = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = db.query(User).filter(User.id == target_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if current user has permission to view this user
    role = current_user["role"]
    current_id = uuid.UUID(current_user["userId"])
    
    if role == "super_admin":
        pass  # can view all
    elif role == "admin":
        if user.corporate_id != current_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == "caregiver":
        # Can view patients assigned to them and family members of those patients
        if user.role == "patient":
            linked = user.caregiver_id == current_id
            if not linked and user.caregiver_ids:
                linked = current_id in user.caregiver_ids
            if not linked:
                raise HTTPException(status_code=403, detail="Access denied")
        elif user.role == "family":
            # Check if this family member is related to any of the caregiver's patients
            related_patients = db.query(User).filter(
                User.role == "patient",
                or_(
                    User.caregiver_id == current_id,
                    text(f"caregiver_ids @> ARRAY['{current_id}']::uuid[]"),
                )
            ).all()
            patient_ids = [p.id for p in related_patients]
            has_relationship = db.query(Relationship).filter(
                Relationship.patient_id.in_(patient_ids),
                Relationship.related_user_id == target_id,
                Relationship.relationship_type == "family"
            ).first()
            if not has_relationship:
                raise HTTPException(status_code=403, detail="Access denied")
    else:
        # Other roles can only view themselves
        if target_id != current_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return user.to_dict()


# ─── GET /api/users/corporate/:corporate_id ─────────────────────────────────
@router.get("/corporate/{corporate_id}")
def get_corporate_users(
    corporate_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] != "super_admin":
        if current_user["role"] != "admin" or current_user["userId"] != corporate_id:
            raise HTTPException(status_code=403, detail="You can only view users under your own organization")

    corp_uuid = uuid.UUID(corporate_id)
    users = (
        db.query(User)
        .filter(User.corporate_id == corp_uuid, User.id != corp_uuid)
        .order_by(User.created_at.desc())
        .all()
    )
    return [u.to_dict() for u in users]


# ─── GET /api/users/stats/me ─────────────────────────────────────────────────
@router.get("/stats/me")
def get_user_stats_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["userId"]
    target = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    base_stats = {
        "total": 0, "admins": 0, "caregivers": 0, "patients": 0, "family": 0,
        "role": target.role, "userId": user_id,
        "corporate_id": str(target.corporate_id) if target.corporate_id else None,
    }

    query = db.query(User).filter(User.id != uuid.UUID(user_id))

    if target.role == "super_admin":
        query = query.filter(User.role != "super_admin")
    elif target.role == "admin":
        query = query.filter(User.corporate_id == uuid.UUID(user_id))
    elif target.role == "caregiver":
        caregiver_uuid = uuid.UUID(user_id)
        query = query.filter(
            or_(
                User.caregiver_id == caregiver_uuid,
                text(f"caregiver_ids @> ARRAY['{caregiver_uuid}']::uuid[]"),
            )
        )
    else:
        return base_stats

    users = query.all()
    base_stats["total"] = len(users)
    for u in users:
        if u.role == "admin":
            base_stats["admins"] += 1
        elif u.role == "caregiver":
            base_stats["caregivers"] += 1
        elif u.role == "patient":
            base_stats["patients"] += 1
        elif u.role == "family":
            base_stats["family"] += 1

    return base_stats

# ─── POST /api/users ─────────────────────────────────────────────────────────
@router.post("/", status_code=201)
def create_user(
    body: dict,
    current_user: dict = Depends(RoleChecker(["super_admin", "admin", "caregiver"])),
    db: Session = Depends(get_db),
):
    actor_role = current_user["role"]
    actor_id = current_user["userId"]
    role = body.get("role")

    allowed = CREATABLE_ROLES.get(actor_role, [])
    if role not in allowed:
        raise HTTPException(status_code=403, detail=f'You are not allowed to create a user with role "{role}"')

    email = body.get("email", "").lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    hashed = pwd_context.hash(body.get("password", ""))
    user = User(
        email=email,
        password=hashed,
        full_name=body.get("full_name", ""),
        role=role,
        status="invited",
        phone_country=body.get("phone_country"),
        phone_number=body.get("phone_number"),
        caregiver_type=body.get("caregiver_type"),
        caregiver_subtype=body.get("caregiver_subtype"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Compute corporate_id
    if role != "super_admin":
        if actor_role == "super_admin":
            user.corporate_id = user.id
        elif actor_role == "admin":
            user.corporate_id = uuid.UUID(actor_id)
        elif actor_role == "caregiver":
            caregiver = db.query(User).filter(User.id == uuid.UUID(actor_id)).first()
            user.corporate_id = caregiver.corporate_id if caregiver and caregiver.corporate_id else uuid.UUID(actor_id)

    # Patient-specific fields
    if role == "patient":
        caregiver_id = body.get("caregiver_id")
        caregiver_ids = body.get("caregiver_ids")

        if isinstance(caregiver_ids, list) and caregiver_ids:
            user.caregiver_ids = [uuid.UUID(cid) for cid in caregiver_ids]
            user.caregiver_id = uuid.UUID(caregiver_id) if caregiver_id else user.caregiver_ids[0]
        elif caregiver_id:
            user.caregiver_id = uuid.UUID(caregiver_id)
            user.caregiver_ids = [user.caregiver_id]
        elif actor_role == "caregiver":
            user.caregiver_id = uuid.UUID(actor_id)
            user.caregiver_ids = [user.caregiver_id]
        family_ids = body.get("family_ids")
        if isinstance(family_ids, list) and family_ids:
            user.family_ids = [uuid.UUID(fid) for fid in family_ids]

    db.commit()
    db.refresh(user)

    # Create Relationship records for family members if this is a patient
    if role == "patient" and user.family_ids:
        for family_id in user.family_ids:
            existing_rel = db.query(Relationship).filter(
                Relationship.patient_id == user.id,
                Relationship.related_user_id == family_id,
                Relationship.relationship_type == "family",
            ).first()
            if not existing_rel:
                rel = Relationship(
                    patient_id=user.id,
                    related_user_id=family_id,
                    relationship_type="family",
                )
                db.add(rel)
        db.commit()

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "caregiver_id": str(user.caregiver_id) if user.caregiver_id else None,
        "caregiver_ids": [str(cid) for cid in user.caregiver_ids] if user.caregiver_ids else [],
        "family_ids": [str(fid) for fid in user.family_ids] if user.family_ids else [],
        "corporate_id": str(user.corporate_id) if user.corporate_id else None,
        "status": user.status,
        "phone_country": user.phone_country,
        "phone_number": user.phone_number,
        "caregiver_type": user.caregiver_type,
        "caregiver_subtype": user.caregiver_subtype,
    }


# ─── PUT /api/users/:id/status ───────────────────────────────────────────────
@router.put("/{user_id}/status")
def update_user_status(
    user_id: str,
    body: dict,
    current_user: dict = Depends(RoleChecker(["super_admin", "admin"])),
    db: Session = Depends(get_db),
):
    status = body.get("status")
    if status not in ["invited", "active", "disabled"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    target = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user["role"] == "admin":
        target_corp = str(target.corporate_id) if target.corporate_id else None
        if target_corp != current_user["userId"]:
            raise HTTPException(status_code=403, detail="You can only change users under your organization")

    target.status = status
    db.commit()
    return {"success": True, "id": str(target.id), "status": target.status}


# ─── PUT /api/users/:id ──────────────────────────────────────────────────────
@router.put("/{user_id}")
def update_user(
    user_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Authorization
    if current_user["userId"] != user_id and current_user["role"] != "super_admin":
        if current_user["role"] == "admin":
            admin_corp = current_user.get("corporate_id")
            if not admin_corp:
                admin = db.query(User).filter(User.id == uuid.UUID(current_user["userId"])).first()
                admin_corp = str(admin.corporate_id) if admin and admin.corporate_id else None
            target_corp = str(target.corporate_id) if target.corporate_id else None
            if target_corp != admin_corp:
                raise HTTPException(status_code=403, detail="You can only update users under your organization")
        else:
            raise HTTPException(status_code=403, detail="You can only update your own details")

    if body.get("full_name"):
        target.full_name = body["full_name"]
    if "phone_country" in body:
        target.phone_country = body["phone_country"]
    if "phone_number" in body:
        target.phone_number = body["phone_number"]
    if "address" in body:
        target.address = body["address"]
    if "caregiver_type" in body:
        target.caregiver_type = body["caregiver_type"]
    if "caregiver_subtype" in body:
        target.caregiver_subtype = body["caregiver_subtype"]

    email = body.get("email")
    if email:
        existing = db.query(User).filter(User.email == email.lower(), User.id != uuid.UUID(user_id)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        target.email = email.lower()

    if target.role == "patient":
        if "caregiver_id" in body:
            target.caregiver_id = uuid.UUID(body["caregiver_id"]) if body["caregiver_id"] else None
        if "caregiver_ids" in body:
            cids = body["caregiver_ids"]
            target.caregiver_ids = [uuid.UUID(cid) for cid in cids] if isinstance(cids, list) else []
            if target.caregiver_ids and not target.caregiver_id:
                target.caregiver_id = target.caregiver_ids[0]
        if "family_ids" in body:
            fids = body["family_ids"]
            new_family_ids = [uuid.UUID(fid) for fid in fids] if isinstance(fids, list) else []
            
            # Delete old relationships that are no longer in the new list
            if target.family_ids:
                old_ids = set(target.family_ids)
                removed_ids = old_ids - set(new_family_ids)
                if removed_ids:
                    db.query(Relationship).filter(
                        Relationship.patient_id == target.id,
                        Relationship.related_user_id.in_(removed_ids),
                        Relationship.relationship_type == "family",
                    ).delete()
            
            # Create new relationships for family members not yet linked
            for family_id in new_family_ids:
                existing_rel = db.query(Relationship).filter(
                    Relationship.patient_id == target.id,
                    Relationship.related_user_id == family_id,
                    Relationship.relationship_type == "family",
                ).first()
                if not existing_rel:
                    rel = Relationship(
                        patient_id=target.id,
                        related_user_id=family_id,
                        relationship_type="family",
                    )
                    db.add(rel)
            
            target.family_ids = new_family_ids

    db.commit()
    db.refresh(target)

    return {
        "id": str(target.id),
        "email": target.email,
        "full_name": target.full_name,
        "role": target.role,
        "caregiver_id": str(target.caregiver_id) if target.caregiver_id else None,
        "caregiver_ids": [str(cid) for cid in target.caregiver_ids] if target.caregiver_ids else [],
        "family_ids": [str(fid) for fid in target.family_ids] if target.family_ids else [],
        "corporate_id": str(target.corporate_id) if target.corporate_id else None,
    }


# ─── DELETE /api/users/:id ───────────────────────────────────────────────────
@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: dict = Depends(RoleChecker(["super_admin", "admin"])),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user["role"] == "admin" and target.role in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete this user")

    if current_user["role"] == "admin":
        target_corp = str(target.corporate_id) if target.corporate_id else None
        if target_corp != current_user["userId"]:
            raise HTTPException(status_code=403, detail="You can only delete users under your organization")

    if str(target.id) == current_user["userId"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db.delete(target)
    db.commit()
    return {"success": True}
