from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.db import get_db
from app.models.medical import Document
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentOut
from app.services.acl import assert_patient_access, is_medical_staff, own_patient_id
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])

STATUTS = ("a_classer", "imprime", "envoye")


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
        "statut": doc.statut,
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
        statut="a_classer",
        document_date=data.document_date,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _to_out(doc)


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    id_patient: int = Form(...),
    document_type: str = Form(...),
    titre: str = Form(...),
    document_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dépose un fichier réel dans le dossier d'un patient."""
    if not is_medical_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel médical.")

    content_type = file.content_type or "application/octet-stream"
    if content_type not in settings.allowed_upload_types:
        raise HTTPException(
            status_code=400,
            detail=(
                "Type de fichier non autorisé. Formats acceptés : PDF, images (PNG, JPEG, WebP), "
                "TXT et Word."
            ),
        )

    data = file.file.read()
    if len(data) > settings.max_upload_kb * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux (maximum {settings.max_upload_kb // 1024} Mo).",
        )

    import os
    import re
    import uuid
    from pathlib import Path

    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)

    base = os.path.basename(file.filename or "document")
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._") or "document"
    stored_name = f"doc_{uuid.uuid4().hex}_{base[:100]}"
    (root / stored_name).write_bytes(data)

    parsed_date = None
    if document_date:
        try:
            parsed_date = date.fromisoformat(document_date)
        except ValueError:
            parsed_date = None

    doc = Document(
        id_patient=id_patient,
        id_uploaded_by_user=current_user.id_user,
        document_type=document_type,
        titre=titre.strip() or base,
        fichier_url=f"/api/documents/stored/{stored_name}",
        mime_type=content_type,
        taille_ko=len(data) // 1024,
        source_label=current_user.staff_profile.nom if current_user.staff_profile else None,
        statut="a_classer",
        document_date=parsed_date or date.today(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _to_out(doc)


@router.get("/stored/{stored_name}")
def download_stored(
    stored_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Télécharge le fichier d'un document, si l'utilisateur a le droit de lecture."""
    if "/" in stored_name or "\\" in stored_name or ".." in stored_name:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide.")

    from pathlib import Path

    doc = (
        db.query(Document)
        .filter(Document.fichier_url == f"/api/documents/stored/{stored_name}")
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    assert_patient_access(current_user, doc.id_patient, db)

    path = Path(settings.upload_dir) / stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur.")

    return FileResponse(
        path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.titre or stored_name,
    )


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: int,
    statut: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change le statut de traitement d'un document (réservé au personnel)."""
    if not is_medical_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel médical.")

    if statut not in STATUTS:
        raise HTTPException(
            status_code=400,
            detail=f"Statut invalide. Valeurs acceptées : {', '.join(STATUTS)}.",
        )

    doc = db.query(Document).filter(Document.id_document == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")

    doc.statut = statut
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
