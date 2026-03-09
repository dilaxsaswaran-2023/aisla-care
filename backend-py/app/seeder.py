from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SUPER_ADMIN_EMAIL = "senz@gmail.com"
SUPER_ADMIN_PASSWORD = "password"
SUPER_ADMIN_NAME = "Super Admin"


def seed_super_admin(db: Session) -> None:
    """Seeds the super-admin user once. If they already exist in the DB, this is a no-op."""
    existing = db.query(User).filter(User.email == SUPER_ADMIN_EMAIL).first()
    if existing:
        print("Super-admin already exists — skipping seed")
        return

    hashed = pwd_context.hash(SUPER_ADMIN_PASSWORD)
    user = User(
        email=SUPER_ADMIN_EMAIL,
        password=hashed,
        full_name=SUPER_ADMIN_NAME,
        role="super_admin",
        status="active",
    )
    db.add(user)
    db.commit()
    print(f"Super-admin seeded: {SUPER_ADMIN_EMAIL}")
