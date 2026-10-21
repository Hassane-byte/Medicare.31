from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationCreate, NotificationOut, NotificationUpdate
from app.services.acl import is_staff
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.id_user == current_user.id_user)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = (
        db.query(Notification)
        .filter(Notification.id_user == current_user.id_user, Notification.is_read.is_(False))
        .count()
    )
    return {"total": total}


@router.post("", response_model=NotificationOut, status_code=201)
def create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envoie une notification à un utilisateur (réservé au personnel)."""
    if not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Réservé au personnel.")

    notif = Notification(
        id_user=data.id_user,
        type_notification=data.type_notification,
        titre=data.titre,
        contenu=data.contenu,
        is_read=False,
        related_entity_type=data.related_entity_type,
        related_entity_id=data.related_entity_id,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


@router.patch("/{notification_id}", response_model=NotificationOut)
def update_notification(
    notification_id: int,
    data: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(Notification.id_notification == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    if notif.id_user != current_user.id_user:
        raise HTTPException(status_code=403, detail="Accès refusé à cette notification.")

    if data.is_read is not None:
        notif.is_read = data.is_read

    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = (
        db.query(Notification)
        .filter(Notification.id_user == current_user.id_user, Notification.is_read.is_(False))
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}


@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = db.query(Notification).filter(Notification.id_notification == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    if notif.id_user != current_user.id_user:
        raise HTTPException(status_code=403, detail="Accès refusé à cette notification.")

    db.delete(notif)
    db.commit()
