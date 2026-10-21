from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.medical import Document, MedicalEvent, MedicalRecord, MedicalVital
from app.models.patient import Patient
from app.models.user import User
from app.schemas.medical import EventIn, EventOut, RecordIn, RecordOut, VitalIn, VitalOut
from app.services.acl import assert_patient_access, is_medical_staff
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/medical", tags=["medical"])


def _get_patient(db: Session, patient_id: int) -> Patient:
    patient = db.query(Patient).filter(Patient.id_patient == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    return patient


# ── Constantes vitales ────────────────────────────────────────────────────────

@router.get("/vitals/{patient_id}", response_model=list[VitalOut])
def list_vitals(
    patient_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_patient(db, patient_id)
    assert_patient_access(current_user, patient_id, db)
    return (
        db.query(MedicalVital)
        .filter(MedicalVital.id_patient == patient_id)
        .order_by(MedicalVital.date_mesure.desc())
        .limit(limit)
        .all()
    )


@router.post("/vitals/{patient_id}", response_model=VitalOut, status_code=201)
def add_vital(
    patient_id: int,
    data: VitalIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_medical_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel médical.")

    _get_patient(db, patient_id)

    staff = getattr(current_user, "staff_profile", None)
    vital = MedicalVital(
        id_patient=patient_id,
        taille_cm=data.taille_cm,
        poids_kg=data.poids_kg,
        tension_arterielle=data.tension_arterielle,
        date_mesure=data.date_mesure or datetime.utcnow(),
        taken_by_staff_id=staff.id_staff if staff else None,
        commentaire=data.commentaire,
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)
    return vital


# ── Dossier médical ──────────────────────────────────────────────────────────

@router.get("/record/{patient_id}", response_model=RecordOut)
def get_record(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_patient(db, patient_id)
    assert_patient_access(current_user, patient_id, db)

    record = db.query(MedicalRecord).filter(MedicalRecord.id_patient == patient_id).first()
    if not record:
        return RecordOut(id_record=0, id_patient=patient_id, antecedents=None, notes_cliniques=None)
    return record


@router.put("/record/{patient_id}", response_model=RecordOut)
def upsert_record(
    patient_id: int,
    data: RecordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_medical_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel médical.")

    _get_patient(db, patient_id)

    record = db.query(MedicalRecord).filter(MedicalRecord.id_patient == patient_id).first()
    if not record:
        record = MedicalRecord(id_patient=patient_id)
        db.add(record)

    record.antecedents = data.antecedents
    record.notes_cliniques = data.notes_cliniques

    db.commit()
    db.refresh(record)
    return record


# ── Événements (historique de consultations) ─────────────────────────────────

@router.get("/events/{patient_id}", response_model=list[EventOut])
def list_events(
    patient_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_patient(db, patient_id)
    assert_patient_access(current_user, patient_id, db)

    events = (
        db.query(MedicalEvent)
        .options(joinedload(MedicalEvent.staff))
        .filter(MedicalEvent.id_patient == patient_id)
        .order_by(MedicalEvent.event_date.desc())
        .limit(limit)
        .all()
    )

    out = []
    for e in events:
        data = EventOut.model_validate(e)
        data.staff_nom = (
            f"Dr. {e.staff.prenom} {e.staff.nom}".strip() if e.staff else None
        )
        out.append(data)
    return out


@router.post("/events/{patient_id}", response_model=EventOut, status_code=201)
def create_event(
    patient_id: int,
    data: EventIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_medical_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel médical.")

    _get_patient(db, patient_id)

    staff = getattr(current_user, "staff_profile", None)
    event = MedicalEvent(
        id_patient=patient_id,
        type_event=data.type_event,
        titre=data.titre,
        description=data.description,
        event_date=data.event_date or datetime.utcnow(),
        id_staff=data.id_staff or (staff.id_staff if staff else None),
        location=data.location,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# ── Documents du dossier (vue patiente) ──────────────────────────────────────

@router.get("/documents/{patient_id}")
def list_patient_documents(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_patient(db, patient_id)
    assert_patient_access(current_user, patient_id, db)

    docs = (
        db.query(Document)
        .filter(Document.id_patient == patient_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        {
            "id_document": d.id_document,
            "document_type": d.document_type,
            "titre": d.titre,
            "fichier_url": d.fichier_url,
            "mime_type": d.mime_type,
            "taille_ko": d.taille_ko,
            "source_label": d.source_label,
            "document_date": d.document_date,
            "created_at": d.created_at,
        }
        for d in docs
    ]
