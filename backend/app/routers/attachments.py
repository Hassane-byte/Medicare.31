"""Dépôt et restitution des pièces jointes de la messagerie."""
import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.message import ConversationParticipant, Message, MessageAttachment
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/messages/attachments", tags=["attachments"])


def upload_root() -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_name(name: str) -> str:
    """Nom de fichier normalisé, sans chemin ni caractères exotiques."""
    base = os.path.basename(name or "fichier")
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._") or "fichier"
    return base[:120]


def _is_participant(thread_id: int, user_id: int, db: Session) -> bool:
    return (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.id_thread == thread_id,
            ConversationParticipant.id_user == user_id,
        )
        .first()
        is not None
    )


@router.post("/message/{message_id}", status_code=201)
async def upload_attachment(
    message_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Joint un fichier à un message que l'on vient d'envoyer."""
    message = db.query(Message).filter(Message.id_message == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message introuvable")

    if message.sender_user_id != current_user.id_user:
        raise HTTPException(
            status_code=403, detail="Vous ne pouvez joindre un fichier qu'à vos propres messages."
        )

    if not _is_participant(message.id_thread, current_user.id_user, db):
        raise HTTPException(status_code=403, detail="Accès refusé à cette conversation.")

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

    file_name = _safe_name(file.filename)
    stored_name = f"{uuid.uuid4().hex}_{file_name}"
    target = upload_root() / stored_name
    target.write_bytes(data)

    attachment = MessageAttachment(
        id_message=message.id_message,
        file_name=file_name,
        file_url=f"/api/messages/attachments/{stored_name}",
        mime_type=content_type,
        file_size_kb=len(data) // 1024,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/{stored_name}")
def download_attachment(
    stored_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Télécharge une pièce jointe, si l'utilisateur participe à la conversation."""
    if "/" in stored_name or "\\" in stored_name or ".." in stored_name:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide.")

    attachment = (
        db.query(MessageAttachment)
        .filter(MessageAttachment.file_url == f"/api/messages/attachments/{stored_name}")
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    message = db.query(Message).filter(Message.id_message == attachment.id_message).first()
    if not message or not _is_participant(message.id_thread, current_user.id_user, db):
        raise HTTPException(status_code=403, detail="Accès refusé à ce fichier.")

    path = upload_root() / stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur.")

    return FileResponse(
        path,
        media_type=attachment.mime_type or "application/octet-stream",
        filename=attachment.file_name or stored_name,
    )
