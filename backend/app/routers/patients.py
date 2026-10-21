from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.db import get_db
from app.models.patient import Patient, PatientContact
from app.services.auth import get_current_user, RoleChecker, User

router = APIRouter(prefix="/api/patients", tags=["patients"])

STAFF_ROLES = ("medecin", "secretariat", "admin")
staff_only = RoleChecker(list(STAFF_ROLES))
medical_staff_only = RoleChecker(["medecin", "admin"])


# ── Schémas ────────────────────────────────────────────────────────────────────

class ContactData(BaseModel):
    email: Optional[str] = None
    telephone_principal: Optional[str] = None
    telephone_secondaire: Optional[str] = None
    adresse_ligne1: Optional[str] = None
    adresse_ligne2: Optional[str] = None
    code_postal: Optional[str] = None
    ville: Optional[str] = None
    pays: str = "France"


class PatientCreate(BaseModel):
    civilite: Optional[str] = None
    nom: str
    prenom: str
    date_naissance: date
    sexe: Optional[str] = None
    groupe_sanguin: Optional[str] = None
    allergie_resume: Optional[str] = None
    statut_patient: str = "actif"
    medecin_traitant_id: Optional[int] = None
    contact: Optional[ContactData] = None


class PatientOut(BaseModel):
    id_patient: int
    numero_dossier: str
    civilite: Optional[str]
    nom: str
    prenom: str
    date_naissance: Optional[date]
    sexe: Optional[str]
    groupe_sanguin: Optional[str]
    allergie_resume: Optional[str]
    statut_patient: Optional[str]
    medecin_traitant_id: Optional[int]
    # coordonnées aplaties depuis patient_contacts
    email: Optional[str] = None
    telephone_principal: Optional[str] = None
    ville: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Helper ────────────────────────────────────────────────────────────────────

def _flatten(patient: Patient) -> dict:
    data = {c.key: getattr(patient, c.key) for c in patient.__table__.columns}
    if patient.contact:
        data["email"] = patient.contact.email
        data["telephone_principal"] = patient.contact.telephone_principal
        data["ville"] = patient.contact.ville
    return data


def _next_dossier(db: Session) -> str:
    import time
    return f"PAT-{int(time.time() * 1000) % 10_000_000:07d}"


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[PatientOut])
def list_patients(
    search: Optional[str] = Query(None),
    statut: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(8, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    q = db.query(Patient).options(joinedload(Patient.contact))
    if search:
        q = q.filter(
            Patient.nom.ilike(f"%{search}%") | Patient.prenom.ilike(f"%{search}%")
        )
    if statut:
        q = q.filter(Patient.statut_patient == statut)
    return [_flatten(p) for p in q.offset(skip).limit(limit).all()]


@router.get("/count")
def count_patients(
    search: Optional[str] = Query(None),
    statut: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
) -> dict:
    q = db.query(Patient)
    if search:
        q = q.filter(
            Patient.nom.ilike(f"%{search}%") | Patient.prenom.ilike(f"%{search}%")
        )
    if statut:
        q = q.filter(Patient.statut_patient == statut)
    return {"total": q.count()}


@router.post("/", response_model=PatientOut, status_code=201)
def create_patient(
    data: PatientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    patient = Patient(
        numero_dossier=_next_dossier(db),
        **{k: v for k, v in data.model_dump(exclude={"contact"}).items()},
    )
    db.add(patient)
    db.flush()

    contact_data = data.contact or ContactData()
    db.add(PatientContact(id_patient=patient.id_patient, **contact_data.model_dump()))
    db.commit()
    db.refresh(patient)
    return _flatten(patient)


@router.get("/me", response_model=PatientOut)
def get_my_patient(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dossier du patient connecté (route patient)."""
    if not current_user.patient_profile:
        raise HTTPException(status_code=404, detail="Aucun dossier patient associé")

    patient = (
        db.query(Patient)
        .options(joinedload(Patient.contact))
        .filter(Patient.id_patient == current_user.patient_profile.id_patient)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    return _flatten(patient)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role.code_role
    if role not in STAFF_ROLES:
        own = current_user.patient_profile
        if not own or own.id_patient != patient_id:
            raise HTTPException(status_code=403, detail="Accès refusé à ce dossier")

    patient = (
        db.query(Patient)
        .options(joinedload(Patient.contact))
        .filter(Patient.id_patient == patient_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    return _flatten(patient)


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    data: PatientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    patient = db.query(Patient).filter(Patient.id_patient == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")

    for key, value in data.model_dump(exclude={"contact"}).items():
        setattr(patient, key, value)

    if data.contact:
        if patient.contact:
            for key, value in data.contact.model_dump().items():
                setattr(patient.contact, key, value)
        else:
            db.add(PatientContact(id_patient=patient.id_patient, **data.contact.model_dump()))

    db.commit()
    db.refresh(patient)
    return _flatten(patient)


@router.delete("/{patient_id}", status_code=204)
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(medical_staff_only),
):
    patient = db.query(Patient).filter(Patient.id_patient == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    db.delete(patient)
    db.commit()
