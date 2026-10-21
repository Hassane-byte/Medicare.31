"""Statistiques du cabinet (personnel) ou du parcours de soin (patient)."""
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.appointment import Appointment
from app.models.medical import Document
from app.models.patient import Patient
from app.models.room import AppointmentType
from app.models.staff import Staff
from app.models.task import Task
from app.models.user import User
from app.services.acl import is_staff, own_patient_id
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/statistiques", tags=["statistiques"])


def _week_bounds(today: date) -> tuple[datetime, datetime]:
    start_day = today - timedelta(days=today.weekday())
    start = datetime.combine(start_day, time.min)
    return start, start + timedelta(days=7)


@router.get("")
def statistiques(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    week_start, week_end = _week_bounds(today)
    month_start = datetime.combine(today.replace(day=1), time.min)

    own_id = own_patient_id(current_user)
    if own_id is not None:
        nb_rdv = (
            db.query(Appointment)
            .filter(Appointment.id_patient == own_id)
            .count()
        )
        nb_termines = (
            db.query(Appointment)
            .filter(
                Appointment.id_patient == own_id,
                Appointment.statut == "termine",
            )
            .count()
        )
        nb_docs = db.query(Document).filter(Document.id_patient == own_id).count()
        nb_taches = (
            db.query(Task)
            .filter(Task.assigned_user_id == current_user.id_user, Task.statut == "todo")
            .count()
        )
        return {
            "role": "patient",
            "patients": [
                {"libelle": "Rendez-vous", "valeur": nb_rdv},
                {"libelle": "Consultations terminées", "valeur": nb_termines},
                {"libelle": "Documents", "valeur": nb_docs},
                {"libelle": "Tâches en cours", "valeur": nb_taches},
            ],
            "repartition": [],
            "par_praticien": [],
            "evolution": [],
        }

    if not is_staff(current_user):
        return {"role": "", "patients": [], "repartition": [], "par_praticien": [], "evolution": []}

    nb_patients = db.query(Patient).count()
    nouveaux_patients = (
        db.query(Patient).filter(Patient.created_at >= month_start).count()
    )
    nb_rdv_semaine = (
        db.query(Appointment)
        .filter(Appointment.start_at >= week_start, Appointment.start_at < week_end)
        .count()
    )
    nb_rdv_mois = (
        db.query(Appointment)
        .filter(Appointment.start_at >= month_start)
        .count()
    )
    nb_annules = (
        db.query(Appointment)
        .filter(Appointment.statut == "annule", Appointment.start_at >= month_start)
        .count()
    )
    nb_termines = (
        db.query(Appointment)
        .filter(Appointment.statut == "termine", Appointment.start_at >= month_start)
        .count()
    )
    nb_confirmes = (
        db.query(Appointment)
        .filter(Appointment.statut == "confirme", Appointment.start_at >= month_start)
        .count()
    )
    nb_attente = (
        db.query(Appointment)
        .filter(Appointment.statut == "en_attente", Appointment.start_at >= month_start)
        .count()
    )

    # Répartition des patients par statut
    par_statut = (
        db.query(Patient.statut_patient, func.count(Patient.id_patient))
        .group_by(Patient.statut_patient)
        .all()
    )
    libelles_statut = {
        "actif": "Actifs",
        "suivi": "Suivi",
        "nouveau": "Nouveaux",
        "inactif": "Inactifs",
    }

    # Répartition des rendez-vous par type de consultation
    counts_by_type = (
        db.query(
            Appointment.id_appointment_type,
            func.count(Appointment.id_appointment),
        )
        .join(Appointment.appointment_type)
        .filter(Appointment.start_at >= month_start)
        .group_by(Appointment.id_appointment_type)
        .all()
    )
    type_libelles = {
        t.id_appointment_type: t.libelle
        for t in db.query(AppointmentType).all()
    }
    repartition_types = [
        {"libelle": type_libelles.get(count[1], "Autre"), "valeur": count[0]}
        for count in counts_by_type
    ]

    # Charge par praticien
    par_praticien = (
        db.query(
            Staff.id_staff,
            Staff.nom,
            Staff.prenom,
            Staff.type_staff,
            func.count(Appointment.id_appointment),
        )
        .join(Appointment, Appointment.id_staff == Staff.id_staff)
        .filter(Appointment.start_at >= month_start)
        .group_by(Staff.id_staff, Staff.nom, Staff.prenom, Staff.type_staff)
        .all()
    )

    # Évolution sur 12 semaines
    evolution = []
    for i in range(11, -1, -1):
        start = week_start - timedelta(weeks=i)
        end = start + timedelta(weeks=1)
        count = (
            db.query(Appointment)
            .filter(Appointment.start_at >= start, Appointment.start_at < end)
            .count()
        )
        evolution.append(
            {"semaine": start.strftime("%d/%m"), "valeur": count}
        )

    return {
        "role": current_user.role.code_role,
        "patients": [
            {"libelle": "Patients au total", "valeur": nb_patients},
            {"libelle": "Nouveaux ce mois", "valeur": nouveaux_patients},
            {"libelle": "RDV cette semaine", "valeur": nb_rdv_semaine},
            {"libelle": "RDV ce mois", "valeur": nb_rdv_mois},
        ],
        "repartition": [
            {"libelle": libelles_statut.get(statut, statut or "Non défini"), "valeur": count}
            for statut, count in par_statut
        ],
        "repartition_types": repartition_types,
        "par_praticien": [
            {
                "id_staff": row[0],
                "libelle": f"Dr. {row[2]} {row[1]}".strip(),
                "specialite": row[3],
                "valeur": row[4],
            }
            for row in par_praticien
        ],
        "evolution": evolution,
        "rendez_vous": {
            "confirmes": nb_confirmes,
            "en_attente": nb_attente,
            "annules": nb_annules,
            "termines": nb_termines,
        },
    }
