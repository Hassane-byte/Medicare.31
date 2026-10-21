from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.call_log import CallLog
from app.models.user import User
from app.schemas.call import CallCreate, CallOut, CallUpdate
from app.services.acl import STAFF_ROLES
from app.services.auth import RoleChecker, get_current_user

router = APIRouter(prefix="/api/calls", tags=["calls"])

staff_only = RoleChecker(list(STAFF_ROLES))

TYPES_APPEL = ("entrant", "sortant")
STATUTS = ("a_traiter", "traite")


def _to_out(call: CallLog) -> dict:
    patient = call.patient
    return {
        "id_call": call.id_call,
        "id_patient": call.id_patient,
        "patient_nom": f"{patient.prenom} {patient.nom}".strip() if patient else None,
        "id_appointment": call.id_appointment,
        "type_appel": call.type_appel,
        "objet": call.objet,
        "notes": call.notes,
        "statut": call.statut,
        "created_at": call.created_at,
    }


@router.get("", response_model=list[CallOut])
def list_calls(
    statut: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    q = db.query(CallLog).options(joinedload(CallLog.patient))
    if statut:
        q = q.filter(CallLog.statut == statut)
    return [_to_out(c) for c in q.order_by(CallLog.created_at.desc()).limit(limit).all()]


@router.post("", response_model=CallOut, status_code=201)
def create_call(
    data: CallCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_only),
):
    if data.type_appel not in TYPES_APPEL:
        raise HTTPException(
            status_code=400,
            detail=f"Type d'appel invalide. Valeurs acceptées : {', '.join(TYPES_APPEL)}.",
        )

    call = CallLog(
        id_user=current_user.id_user,
        id_patient=data.id_patient,
        id_appointment=data.id_appointment,
        type_appel=data.type_appel,
        objet=data.objet.strip(),
        notes=data.notes,
        statut="a_traiter",
        created_by_user_id=current_user.id_user,
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return _to_out(call)


@router.patch("/{call_id}", response_model=CallOut)
def update_call(
    call_id: int,
    data: CallUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    call = db.query(CallLog).filter(CallLog.id_call == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Appel introuvable")

    payload = data.model_dump(exclude_unset=True)
    if payload.get("statut") is not None:
        if payload["statut"] not in STATUTS:
            raise HTTPException(
                status_code=400,
                detail=f"Statut invalide. Valeurs acceptées : {', '.join(STATUTS)}.",
            )
        call.statut = payload["statut"]

    for field in ("objet", "notes", "id_patient", "id_appointment"):
        if field in payload and payload[field] is not None:
            setattr(call, field, payload[field])

    db.commit()
    db.refresh(call)
    return _to_out(call)


@router.delete("/{call_id}", status_code=204)
def delete_call(
    call_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(staff_only),
):
    call = db.query(CallLog).filter(CallLog.id_call == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Appel introuvable")
    db.delete(call)
    db.commit()
