"""Règles d'accès aux dossiers patients, partagées par les routers."""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User

STAFF_ROLES = ("medecin", "secretariat", "admin")
MEDICAL_ROLES = ("medecin", "admin")


def is_staff(user: User) -> bool:
    return user.role.code_role in STAFF_ROLES


def is_medical_staff(user: User) -> bool:
    return user.role.code_role in MEDICAL_ROLES


def own_patient_id(user: User) -> Optional[int]:
    """Identifiant du dossier patient rattaché à l'utilisateur, sinon None."""
    profile = getattr(user, "patient_profile", None)
    return profile.id_patient if profile else None


def assert_patient_access(user: User, patient_id: int, db: Session) -> None:
    """Lève une 403 si l'utilisateur n'a pas le droit de lire ce dossier."""
    if is_staff(user):
        return
    own = own_patient_id(user)
    if own is None or own != patient_id:
        raise HTTPException(
            status_code=403,
            detail="Vous n'avez pas les permissions nécessaires pour accéder à cette ressource",
        )


def assert_patient_write(user: User) -> None:
    """Écriture sur un dossier : réservée au personnel médical."""
    if not is_medical_staff(user):
        raise HTTPException(
            status_code=403,
            detail="Vous n'avez pas les permissions nécessaires pour accéder à cette ressource",
        )
