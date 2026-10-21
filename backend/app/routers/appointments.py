from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.room import AppointmentType, Room
from app.models.staff import Staff
from app.models.user import User
from app.services.auth import RoleChecker, get_current_user

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

STAFF_ROLES = ["medecin", "secretariat", "admin"]
staff_only = RoleChecker(STAFF_ROLES)

STATUS_LABELS = {
    "en_attente": "En attente",
    "confirme": "Confirmé",
    "annule": "Annulé",
    "termine": "Terminé",
}
STATUS_CODES = {
    "en attente": "en_attente",
    "en_attente": "en_attente",
    "confirmé": "confirme",
    "confirme": "confirme",
    "annulé": "annule",
    "annule": "annule",
    "terminé": "termine",
    "termine": "termine",
}


def _normalize_status(value: str) -> str:
    code = STATUS_CODES.get((value or "").strip().lower())
    if not code:
        raise HTTPException(
            status_code=400,
            detail="Statut invalide. Valeurs acceptées : En attente, Confirmé, Annulé, Terminé.",
        )
    return code


def _staff_display(staff: Optional[Staff]) -> str:
    if not staff:
        return ""
    name = f"{staff.prenom or ''} {staff.nom or ''}".strip()
    return f"Dr. {name}" if staff.type_staff == "medecin" else name


def _to_out(a: Appointment) -> dict:
    return {
        "id_appointment": a.id_appointment,
        "id_patient": a.id_patient,
        "patient_nom": f"{a.patient.prenom} {a.patient.nom}".strip() if a.patient else "",
        "id_staff": a.id_staff,
        "staff_nom": _staff_display(a.staff),
        "id_room": a.id_room,
        "room_nom": a.room.nom if a.room else None,
        "id_appointment_type": a.id_appointment_type,
        "type_libelle": a.appointment_type.libelle if a.appointment_type else None,
        "start_at": a.start_at,
        "end_at": a.end_at,
        "date": a.start_at.date().isoformat(),
        "start": a.start_at.strftime("%H:%M"),
        "end": a.end_at.strftime("%H:%M"),
        "statut": a.statut,
        "status_label": STATUS_LABELS.get(a.statut, a.statut),
        "couleur": a.couleur or "blue",
        "notes": a.notes or "",
    }


def _with_relations(query):
    return query.options(
        joinedload(Appointment.patient),
        joinedload(Appointment.staff),
        joinedload(Appointment.room),
        joinedload(Appointment.appointment_type),
    )


def _range_filter(query, start: Optional[date], end: Optional[date]):
    if start:
        query = query.filter(Appointment.start_at >= datetime.combine(start, time.min))
    if end:
        query = query.filter(
            Appointment.start_at < datetime.combine(end + timedelta(days=1), time.min)
        )
    return query


# ── Données de référence ───────────────────────────────────────────────────────


@router.get("/staff")
def list_staff(
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    staff = (
        db.query(Staff)
        .filter(Staff.type_staff.in_(["medecin", "secretariat", "admin"]))
        .order_by(Staff.nom, Staff.prenom)
        .all()
    )
    return [
        {
            "id_staff": s.id_staff,
            "nom": s.nom,
            "prenom": s.prenom,
            "specialite": s.specialite,
            "type_staff": s.type_staff,
            "couleur_agenda": s.couleur_agenda,
            "display": _staff_display(s),
        }
        for s in staff
    ]


@router.get("/rooms")
def list_rooms(
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    rooms = db.query(Room).filter(Room.is_active.is_(True)).order_by(Room.nom).all()
    return [{"id_room": r.id_room, "nom": r.nom, "description": r.description} for r in rooms]


@router.get("/types")
def list_types(
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    types = db.query(AppointmentType).order_by(AppointmentType.libelle).all()
    return [
        {
            "id_appointment_type": t.id_appointment_type,
            "libelle": t.libelle,
            "duree_par_defaut_min": t.duree_par_defaut_min,
        }
        for t in types
    ]


# ── Schémas ────────────────────────────────────────────────────────────────────


class AppointmentCreate(BaseModel):
    id_patient: int
    id_staff: int
    id_room: Optional[int] = None
    id_appointment_type: Optional[int] = None
    start_at: datetime
    end_at: datetime
    statut: str = "En attente"
    couleur: str = Field(default="blue", max_length=20)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_times(self):
        if self.end_at <= self.start_at:
            raise ValueError("L'heure de fin doit être postérieure à l'heure de début.")
        return self


# ── Rendez-vous ────────────────────────────────────────────────────────────────


@router.get("/mine")
def my_appointments(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.patient_profile:
        raise HTTPException(status_code=404, detail="Aucun dossier patient associé")

    q = _with_relations(
        db.query(Appointment).filter(
            Appointment.id_patient == current_user.patient_profile.id_patient
        )
    )
    q = _range_filter(q, start, end)
    return [_to_out(a) for a in q.order_by(Appointment.start_at).all()]


@router.get("/")
def list_appointments(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    staff_id: Optional[int] = Query(None),
    patient_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    q = _with_relations(db.query(Appointment))
    q = _range_filter(q, start, end)
    if staff_id:
        q = q.filter(Appointment.id_staff == staff_id)
    if patient_id:
        q = q.filter(Appointment.id_patient == patient_id)
    return [_to_out(a) for a in q.order_by(Appointment.start_at).all()]


def _validate_references(data: AppointmentCreate, db: Session) -> None:
    if not db.query(Patient).filter(Patient.id_patient == data.id_patient).first():
        raise HTTPException(status_code=404, detail="Patient introuvable")
    if not db.query(Staff).filter(Staff.id_staff == data.id_staff).first():
        raise HTTPException(status_code=404, detail="Médecin introuvable")
    if data.id_room and not db.query(Room).filter(Room.id_room == data.id_room).first():
        raise HTTPException(status_code=404, detail="Salle introuvable")
    if data.id_appointment_type and not db.query(AppointmentType).filter(
        AppointmentType.id_appointment_type == data.id_appointment_type
    ).first():
        raise HTTPException(status_code=404, detail="Type de consultation introuvable")


def _check_overlap(
    data: AppointmentCreate, db: Session, exclude_id: Optional[int] = None
) -> None:
    q = db.query(Appointment).filter(
        Appointment.id_staff == data.id_staff,
        Appointment.statut != "annule",
        Appointment.start_at < data.end_at,
        Appointment.end_at > data.start_at,
    )
    if exclude_id:
        q = q.filter(Appointment.id_appointment != exclude_id)
    if q.first():
        raise HTTPException(
            status_code=409,
            detail="Ce médecin a déjà un rendez-vous sur ce créneau.",
        )


@router.post("/", status_code=201)
def create_appointment(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_only),
):
    _validate_references(data, db)
    _check_overlap(data, db)

    appt = Appointment(
        id_patient=data.id_patient,
        id_staff=data.id_staff,
        id_room=data.id_room,
        id_appointment_type=data.id_appointment_type,
        start_at=data.start_at,
        end_at=data.end_at,
        statut=_normalize_status(data.statut),
        couleur=data.couleur or "blue",
        notes=data.notes,
        created_by_user_id=current_user.id_user,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    appt = _with_relations(db.query(Appointment)).filter(
        Appointment.id_appointment == appt.id_appointment
    ).first()
    return _to_out(appt)


@router.get("/{appointment_id}")
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = _with_relations(db.query(Appointment)).filter(
        Appointment.id_appointment == appointment_id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")

    if current_user.role.code_role not in STAFF_ROLES:
        own = current_user.patient_profile
        if not own or own.id_patient != appt.id_patient:
            raise HTTPException(status_code=403, detail="Accès refusé à ce rendez-vous")

    return _to_out(appt)


@router.put("/{appointment_id}")
def update_appointment(
    appointment_id: int,
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_only),
):
    appt = db.query(Appointment).filter(
        Appointment.id_appointment == appointment_id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")

    _validate_references(data, db)
    _check_overlap(data, db, exclude_id=appointment_id)

    appt.id_patient = data.id_patient
    appt.id_staff = data.id_staff
    appt.id_room = data.id_room
    appt.id_appointment_type = data.id_appointment_type
    appt.start_at = data.start_at
    appt.end_at = data.end_at
    appt.statut = _normalize_status(data.statut)
    appt.couleur = data.couleur or "blue"
    appt.notes = data.notes
    appt.updated_by_user_id = current_user.id_user

    db.commit()
    db.refresh(appt)
    appt = _with_relations(db.query(Appointment)).filter(
        Appointment.id_appointment == appointment_id
    ).first()
    return _to_out(appt)


@router.delete("/{appointment_id}", status_code=204)
def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    appt = db.query(Appointment).filter(
        Appointment.id_appointment == appointment_id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    db.delete(appt)
    db.commit()
