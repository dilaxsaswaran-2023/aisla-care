from typing import Optional, List
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.jwt_utils import verify_access_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    """Dependency that extracts and verifies the JWT from the Authorization header."""
    try:
        payload = verify_access_token(db, credentials.credentials)
        return payload
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class RoleChecker:
    """Dependency that checks if the current user has one of the allowed roles.
    super_admin always passes."""

    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") == "super_admin":
            return current_user
        if current_user.get("role") not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return current_user
