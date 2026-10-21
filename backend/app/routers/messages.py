from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func

from app.db import get_db
from app.models.user import User
from app.models.role import Role
from app.models.staff import Staff
from app.models.patient import Patient
from app.models.message import ConversationThread, ConversationParticipant, Message
from app.schemas.message import (
    UserMiniOut,
    MessageOut,
    ConversationOut,
    ConversationDetailOut,
    MessageCreate,
    ConversationCreate,
)
from app.services.auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _profile_name(user: User) -> tuple[str, str]:
    if user.staff_profile:
        return user.staff_profile.nom or "", user.staff_profile.prenom or ""
    if user.patient_profile:
        return user.patient_profile.nom or "", user.patient_profile.prenom or ""
    return "", ""


def _is_online(user: User) -> bool:
    if not user.last_login_at:
        return False

    return datetime.utcnow() - user.last_login_at < timedelta(minutes=2)


def _user_to_mini(user: User) -> UserMiniOut:
    nom, prenom = _profile_name(user)

    return UserMiniOut(
        id_user=user.id_user,
        email=user.email,
        nom=nom,
        prenom=prenom,
        role=user.role.code_role if user.role else "",
        is_online=_is_online(user),
        last_seen_at=user.last_login_at,
    )

def _require_participant(thread_id: int, user_id: int, db: Session) -> ConversationParticipant:
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.id_thread == thread_id,
            ConversationParticipant.id_user == user_id,
        )
        .first()
    )

    if not participant:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    return participant


def _message_to_out(message: Message) -> MessageOut:
    return MessageOut(
        id_message=message.id_message,
        id_thread=message.id_thread,
        sender_user_id=message.sender_user_id,
        sender=_user_to_mini(message.sender),
        body=message.body,
        sent_at=message.sent_at,
        is_urgent=message.is_urgent,
        reply_to_message_id=message.reply_to_message_id,
        attachments=message.attachments or [],
    )


def _thread_to_out(thread: ConversationThread, current_user_id: int) -> ConversationOut:
    participant_row = next(
        (p for p in thread.participants if p.id_user == current_user_id),
        None,
    )

    last_message = None
    if thread.messages:
        last_message = sorted(thread.messages, key=lambda m: m.sent_at)[-1]

    users = [_user_to_mini(p.user) for p in thread.participants]

    return ConversationOut(
        id_thread=thread.id_thread,
        sujet=thread.sujet,
        category=thread.category,
        priority=thread.priority,
        is_archived=thread.is_archived,
        created_by_user_id=thread.created_by_user_id,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        unread_count=participant_row.unread_count if participant_row else 0,
        last_message=last_message.body if last_message else None,
        last_message_at=last_message.sent_at if last_message else None,
        participants=users,
    )


@router.get("/users", response_model=list[UserMiniOut])
def list_message_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = (
        db.query(User)
        .options(
            joinedload(User.role),
            joinedload(User.staff_profile),
            joinedload(User.patient_profile),
        )
        .filter(User.is_active == True)
        .filter(User.id_user != current_user.id_user)
        .order_by(User.email.asc())
        .all()
    )

    return [_user_to_mini(user) for user in users]


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    threads = (
        db.query(ConversationThread)
        .join(ConversationParticipant)
        .options(
            joinedload(ConversationThread.participants).joinedload(ConversationParticipant.user).joinedload(User.role),
            joinedload(ConversationThread.participants).joinedload(ConversationParticipant.user).joinedload(User.staff_profile),
            joinedload(ConversationThread.participants).joinedload(ConversationParticipant.user).joinedload(User.patient_profile),
            joinedload(ConversationThread.messages).joinedload(Message.sender).joinedload(User.role),
            joinedload(ConversationThread.messages).joinedload(Message.sender).joinedload(User.staff_profile),
            joinedload(ConversationThread.messages).joinedload(Message.sender).joinedload(User.patient_profile),
        )
        .filter(ConversationParticipant.id_user == current_user.id_user)
        .filter(ConversationThread.is_archived == archived)
        .order_by(ConversationThread.updated_at.desc())
        .all()
    )

    return [_thread_to_out(thread, current_user.id_user) for thread in threads]


@router.get("/conversations/{thread_id}", response_model=ConversationDetailOut)
def get_conversation(
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_participant(thread_id, current_user.id_user, db)

    thread = (
        db.query(ConversationThread)
        .options(
            joinedload(ConversationThread.participants).joinedload(ConversationParticipant.user).joinedload(User.role),
            joinedload(ConversationThread.participants).joinedload(ConversationParticipant.user).joinedload(User.staff_profile),
            joinedload(ConversationThread.participants).joinedload(ConversationParticipant.user).joinedload(User.patient_profile),
            joinedload(ConversationThread.messages).joinedload(Message.sender).joinedload(User.role),
            joinedload(ConversationThread.messages).joinedload(Message.sender).joinedload(User.staff_profile),
            joinedload(ConversationThread.messages).joinedload(Message.sender).joinedload(User.patient_profile),
            joinedload(ConversationThread.messages).joinedload(Message.attachments),
        )
        .filter(ConversationThread.id_thread == thread_id)
        .first()
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    participant = _require_participant(thread_id, current_user.id_user, db)
    participant.unread_count = 0
    participant.last_read_at = func.now()
    db.commit()

    base = _thread_to_out(thread, current_user.id_user)

    return ConversationDetailOut(
        **base.model_dump(),
        messages=[_message_to_out(message) for message in sorted(thread.messages, key=lambda m: m.sent_at)],
    )


@router.post("/conversations", response_model=ConversationDetailOut, status_code=201)
def create_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    participant_ids = list(set(data.participant_ids))

    if current_user.id_user in participant_ids:
        participant_ids.remove(current_user.id_user)

    if not participant_ids:
        raise HTTPException(status_code=400, detail="Ajoutez au moins un destinataire")

    users_count = db.query(User).filter(User.id_user.in_(participant_ids)).count()
    if users_count != len(participant_ids):
        raise HTTPException(status_code=400, detail="Un destinataire est introuvable")

    thread = ConversationThread(
        sujet=data.sujet,
        category=data.category,
        priority=data.priority,
        created_by_user_id=current_user.id_user,
    )
    db.add(thread)
    db.flush()

    db.add(ConversationParticipant(
        id_thread=thread.id_thread,
        id_user=current_user.id_user,
        role_in_thread="sender",
        unread_count=0,
    ))

    for user_id in participant_ids:
        db.add(ConversationParticipant(
            id_thread=thread.id_thread,
            id_user=user_id,
            role_in_thread="recipient",
            unread_count=1,
        ))

    message = Message(
        id_thread=thread.id_thread,
        sender_user_id=current_user.id_user,
        body=data.body,
        is_urgent=data.priority == "urgent",
    )
    db.add(message)

    thread.updated_at = func.now()

    db.commit()

    return get_conversation(thread.id_thread, db, current_user)


@router.post("/conversations/{thread_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    thread_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_participant(thread_id, current_user.id_user, db)

    if not data.body.strip():
        raise HTTPException(status_code=400, detail="Message vide")

    message = Message(
        id_thread=thread_id,
        sender_user_id=current_user.id_user,
        body=data.body.strip(),
        is_urgent=data.is_urgent,
        reply_to_message_id=data.reply_to_message_id,
    )

    db.add(message)

    participants = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.id_thread == thread_id)
        .all()
    )

    for participant in participants:
        if participant.id_user != current_user.id_user:
            participant.unread_count = (participant.unread_count or 0) + 1

    thread = db.query(ConversationThread).filter(ConversationThread.id_thread == thread_id).first()
    if thread:
        thread.updated_at = func.now()

    db.commit()
    db.refresh(message)

    message = (
        db.query(Message)
        .options(
            joinedload(Message.sender).joinedload(User.role),
            joinedload(Message.sender).joinedload(User.staff_profile),
            joinedload(Message.sender).joinedload(User.patient_profile),
            joinedload(Message.attachments),
        )
        .filter(Message.id_message == message.id_message)
        .first()
    )

    return _message_to_out(message)


@router.patch("/conversations/{thread_id}/read")
def mark_as_read(
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    participant = _require_participant(thread_id, current_user.id_user, db)
    participant.unread_count = 0
    participant.last_read_at = func.now()
    db.commit()

    return {"status": "ok"}


@router.patch("/conversations/{thread_id}/archive")
def archive_conversation(
    thread_id: int,
    archived: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_participant(thread_id, current_user.id_user, db)

    thread = db.query(ConversationThread).filter(ConversationThread.id_thread == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    thread.is_archived = archived
    db.commit()

    return {"status": "ok", "archived": archived}

@router.delete("/conversations/{thread_id}")
def delete_conversation(
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_participant(thread_id, current_user.id_user, db)

    thread = db.query(ConversationThread).filter(
        ConversationThread.id_thread == thread_id
    ).first()

    if not thread:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    db.query(MessageAttachment).join(Message).filter(
        Message.id_thread == thread_id
    ).delete(synchronize_session=False)

    db.query(Message).filter(
        Message.id_thread == thread_id
    ).delete(synchronize_session=False)

    db.query(ConversationParticipant).filter(
        ConversationParticipant.id_thread == thread_id
    ).delete(synchronize_session=False)

    db.delete(thread)
    db.commit()

    return {"status": "ok", "deleted": True}