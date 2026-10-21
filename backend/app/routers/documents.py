from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.medical import Document
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentOut
from app.services.acl import assert_patient_access, is_medical_staff, own_patient_id
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _to_out(doc: Document) -> dict:
    patient = doc.patient
    return {
        "id_document": doc.id_document,
        "id_patient": doc.id_patient,
        "patient_nom": f"{patient.prenom} {patient.nom}".strip() if patient else None,
        "document_type": doc.document_type,
        "titre": doc.titre,
        "fichier_url": doc.fichier_url,
        "mime_type": doc.mime_type,
        "taille_ko": doc.taille_ko,
        "source_label": doc.source_label,
        "document_date": doc.document_date,
        "created_at": doc.created_at,
    }


@router.get("", response_model=list[DocumentOut])
def list_documents(
    id_patient: Optional[int] = Query(None),
    document_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Le personnel voit tous les documents, le patient seulement les siens."""
    q = db.query(Document).options(joinedload(Document.patient))

    own = own_patient_id(current_user)
    if own is not None:
        q = q.filter(Document.id_patient == own)
    elif id_patient is not None:
        q = q.filter(Document.id_patient == id_patient)

    if document_type:
        q = q.filter(Document.document_type == document_type)

    return [_to_out(d) for d in q.order_by(Document.created_at.desc()).limit(limit).all()]


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).options(joinedload(Document.patient)).filter(
        Document.id_document == document_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    assert_patient_access(current_user, doc.id_patient, db)
    return _to_out(doc)


@router.post("", response_model=DocumentOut, status_code=201)
def create_document(
    data: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dépôt d'un document dans le dossier d'un patient (réservé au personnel)."""
    if not is_medical_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel médical.")

    doc = Document(
        id_patient=data.id_patient,
        id_uploaded_by_user=current_user.id_user,
        document_type=data.document_type,
        titre=data.titre,
        fichier_url=data.fichier_url,
        mime_type=data.mime_type,
        taille_ko=data.taille_ko,
        source_label=data.source_label,
        document_date=data.document_date,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _to_out(doc)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_medical_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel médical.")

    doc = db.query(Document).filter(Document.id_document == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    db.delete(doc)
    db.commit()
