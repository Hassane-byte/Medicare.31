"""Agrégats de tableau de bord, adaptés au rôle de l'utilisateur connecté."""
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.appointment import Appointment
from app.models.call_log import CallLog
from app.models.medical import Document, MedicalEvent, MedicalVital
from app.models.message import ConversationParticipant, ConversationThread, Message
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.task import Task
from app.models.user import User
from app.services.acl import is_staff, own_patient_id
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

STATUTS_TERMINES = ("annule", "termine")


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min)
    return start, start + timedelta(days=1)


def _appt_out(a: Appointment) -> dict:
    patient = a.patient
    staff = a.staff
    return {
        "id_appointment": a.id_appointment,
        "id_patient": a.id_patient,
        "patient_nom": f"{patient.prenom} {patient.nom}".strip() if patient else "",
        "id_staff": a.id_staff,
        "staff_nom": (f"Dr. {staff.prenom} {staff.nom}".strip() if staff else ""),
        "id_room": a.id_room,
        "room_nom": a.room.nom if a.room else None,
        "type_libelle": a.appointment_type.libelle if a.appointment_type else None,
        "start_at": a.start_at,
        "end_at": a.end_at,
        "date": a.start_at.date().isoformat(),
        "start": a.start_at.strftime("%H:%M"),
        "end": a.end_at.strftime("%H:%M"),
        "statut": a.statut,
        "notes": a.notes or "",
        "checked_in_at": a.checked_in_at,
    }


def _conversations_for(db: Session, user_id: int, limit: int = 3) -> list[dict]:
    rows = (
        db.query(ConversationParticipant)
        .join(ConversationThread)
        .options(
            joinedload(ConversationParticipant.thread)
            .joinedload(ConversationThread.messages)
            .joinedload(Message.sender),
            joinedload(ConversationParticipant.thread)
            .joinedload(ConversationThread.participants)
            .joinedload(ConversationParticipant.user),
        )
        .filter(
            ConversationParticipant.id_user == user_id,
            ConversationThread.is_archived.is_(False),
        )
        .order_by(ConversationThread.updated_at.desc())
        .limit(limit)
        .all()
    )

    out = []
    for participant in rows:
        thread = participant.thread
        last = None
        if thread.messages:
            last = sorted(thread.messages, key=lambda m: m.sent_at)[-1]
        others = [p.user for p in thread.participants if p.id_user != user_id]
        other = others[0] if others else None
        sender_name = ""
        if other is not None:
            sender_name = other.patient_profile.nom if other.patient_profile else (
                other.staff_profile.nom if other.staff_profile else ""
            )
        out.append(
            {
                "id_thread": thread.id_thread,
                "sujet": thread.sujet or "Sans objet",
                "expediteur": sender_name,
                "apercu": (last.body[:120] if last and last.body else ""),
                "date": last.sent_at.isoformat() if last else None,
                "non_lu": participant.unread_count or 0,
                "priority": thread.priority,
            }
        )
    return out


def _unread_total(db: Session, user_id: int) -> int:
    total = (
        db.query(
            func.coalesce(func.sum(ConversationParticipant.unread_count), 0)
        )
        .filter(
            ConversationParticipant.id_user == user_id,
            ConversationParticipant.unread_count > 0,
        )
        .scalar()
    )
    return int(total or 0)


def _notifications_for(db: Session, user_id: int, limit: int = 5) -> list[dict]:
    rows = (
        db.query(Notification)
        .filter(Notification.id_user == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id_notification": n.id_notification,
            "type_notification": n.type_notification,
            "titre": n.titre,
            "contenu": n.contenu or "",
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]


@router.get("")
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toutes les données des tableaux de bord, en une seule requête."""
    today = date.today()
    day_start, day_end = _day_bounds(today)
    role = current_user.role.code_role

    payload = {
        "role": role,
        "date": today.isoformat(),
        "stats": {},
        "prochains_rdv": [],
        "salle_attente": [],
        "derniers_messages": [],
        "taches": [],
        "notifications": [],
        "historique": [],
        "constantes": {},
        "documents": [],
        "prochain_rdv": None,
    }

    # ── Tâches et notifications (tous rôles) ─────────────────────────────────
    tasks = (
        db.query(Task)
        .filter(Task.assigned_user_id == current_user.id_user, Task.statut == "todo")
        .order_by(Task.created_at.desc())
        .all()
    )
    payload["taches"] = [
        {
            "id_task": t.id_task,
            "titre": t.titre,
            "description": t.description or "",
            "statut": t.statut,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }
        for t in tasks
    ]
    payload["notifications"] = _notifications_for(db, current_user.id_user)
    unread_notifs = sum(1 for n in payload["notifications"] if not n["is_read"])

    # ── Patient ──────────────────────────────────────────────────────────────
    own_id = own_patient_id(current_user)
    if own_id is not None:
        patient = db.query(Patient).filter(Patient.id_patient == own_id).first()

        appts = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.patient),
                joinedload(Appointment.staff),
                joinedload(Appointment.room),
                joinedload(Appointment.appointment_type),
            )
            .filter(Appointment.id_patient == own_id)
            .filter(Appointment.start_at >= datetime.utcnow())
            .filter(Appointment.statut.notin_(STATUTS_TERMINES))
            .order_by(Appointment.start_at)
            .all()
        )
        if appts:
            payload["prochain_rdv"] = _appt_out(appts[0])
        payload["prochains_rdv"] = [_appt_out(a) for a in appts[:5]]

        events = (
            db.query(MedicalEvent)
            .options(joinedload(MedicalEvent.staff))
            .filter(MedicalEvent.id_patient == own_id)
            .order_by(MedicalEvent.event_date.desc())
            .limit(5)
            .all()
        )
        payload["historique"] = [
            {
                "id_event": e.id_event,
                "titre": e.titre,
                "type_event": e.type_event,
                "description": e.description or "",
                "event_date": e.event_date.isoformat(),
                "staff_nom": (
                    f"Dr. {e.staff.prenom} {e.staff.nom}".strip() if e.staff else None
                ),
            }
            for e in events
        ]

        vital = (
            db.query(MedicalVital)
            .filter(MedicalVital.id_patient == own_id)
            .order_by(MedicalVital.date_mesure.desc())
            .first()
        )
        if vital:
            payload["constantes"] = {
                "taille_cm": vital.taille_cm,
                "poids_kg": vital.poids_kg,
                "tension_arterielle": vital.tension_arterielle,
                "date_mesure": vital.date_mesure.isoformat(),
            }

        docs = (
            db.query(Document)
            .filter(Document.id_patient == own_id)
            .order_by(Document.created_at.desc())
            .all()
        )
        payload["documents"] = [
            {
                "id_document": d.id_document,
                "document_type": d.document_type,
                "titre": d.titre,
                "fichier_url": d.fichier_url,
                "statut": d.statut,
                "document_date": d.document_date.isoformat() if d.document_date else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]

        payload["derniers_messages"] = _conversations_for(db, current_user.id_user)
        payload["stats"] = {
            "rdv_a_venir": len(appts),
            "messages_non_lus": _unread_total(db, current_user.id_user),
            "documents": len(docs),
            "notifications_non_lues": unread_notifs,
        }
        return payload

    # ── Personnel ────────────────────────────────────────────────────────────
    if not is_staff(current_user):
        return payload

    day_appts = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.staff),
            joinedload(Appointment.room),
            joinedload(Appointment.appointment_type),
        )
        .filter(Appointment.start_at >= day_start)
        .filter(Appointment.start_at < day_end)
        .order_by(Appointment.start_at)
        .all()
    )

    upcoming = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.staff),
            joinedload(Appointment.room),
            joinedload(Appointment.appointment_type),
        )
        .filter(Appointment.start_at >= datetime.utcnow())
        .filter(Appointment.statut.notin_(STATUTS_TERMINES))
        .order_by(Appointment.start_at)
        .limit(10)
        .all()
    )
    payload["prochains_rdv"] = [_appt_out(a) for a in upcoming]

    waiting = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.staff),
            joinedload(Appointment.room),
            joinedload(Appointment.appointment_type),
        )
        .filter(Appointment.checked_in_at.isnot(None))
        .filter(Appointment.start_at >= day_start)
        .filter(Appointment.start_at < day_end)
        .filter(Appointment.statut.notin_(STATUTS_TERMINES))
        .order_by(Appointment.checked_in_at)
        .all()
    )
    payload["salle_attente"] = [
        {
            **_appt_out(a),
            "heure_arrivee": a.checked_in_at.strftime("%H:%M") if a.checked_in_at else None,
        }
        for a in waiting
    ]

    payload["derniers_messages"] = _conversations_for(db, current_user.id_user)

    rdv_a_confirmer = sum(1 for a in day_appts if a.statut == "en_attente")
    appels_a_traiter = (
        db.query(CallLog).filter(CallLog.statut == "a_traiter").count()
    )
    docs_a_classer = (
        db.query(Document).filter(Document.statut == "a_classer").count()
    )

    payload["stats"] = {
        "rdv_jour": len(day_appts),
        "salle_attente": len(waiting),
        "messages_non_lus": _unread_total(db, current_user.id_user),
        "taches_a_faire": len(payload["taches"]),
        "rdv_a_confirmer": rdv_a_confirmer,
        "patients_arrivees": len(waiting),
        "appels_a_traiter": appels_a_traiter,
        "documents_en_attente": docs_a_classer,
        "notifications_non_lues": unread_notifs,
        "total_patients": db.query(Patient).count(),
    }

    if role == "secretariat":
        calls = (
            db.query(CallLog)
            .options(joinedload(CallLog.patient))
            .order_by(CallLog.created_at.desc())
            .limit(5)
            .all()
        )
        payload["appels"] = [
            {
                "id_call": c.id_call,
                "patient_nom": (
                    f"{c.patient.prenom} {c.patient.nom}".strip() if c.patient else ""
                ),
                "objet": c.objet,
                "statut": c.statut,
                "type_appel": c.type_appel,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in calls
        ]

        docs = (
            db.query(Document)
            .options(joinedload(Document.patient))
            .order_by(Document.created_at.desc())
            .limit(5)
            .all()
        )
        payload["documents"] = [
            {
                "id_document": d.id_document,
                "document_type": d.document_type,
                "titre": d.titre,
                "patient_nom": (
                    f"{d.patient.prenom} {d.patient.nom}".strip() if d.patient else ""
                ),
                "statut": d.statut,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]

    return payload
