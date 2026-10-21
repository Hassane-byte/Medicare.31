from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.acl import STAFF_ROLES, is_staff
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

STATUTS = ("todo", "done")


@router.get("", response_model=list[TaskOut])
def list_tasks(
    assigned_user_id: Optional[int] = Query(None),
    statut: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mes tâches par défaut. Le personnel peut consulter celles d'un collègue."""
    q = db.query(Task)

    if assigned_user_id is not None:
        if not is_staff(current_user):
            raise HTTPException(status_code=403, detail="Accès refusé aux tâches d'autrui.")
        q = q.filter(Task.assigned_user_id == assigned_user_id)
    else:
        q = q.filter(Task.assigned_user_id == current_user.id_user)

    if statut:
        q = q.filter(Task.statut == statut)

    return q.order_by(Task.statut, Task.created_at.desc()).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_id = data.assigned_user_id or current_user.id_user
    if target_id != current_user.id_user and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Vous ne pouvez créer une tâche que pour vous.")

    task = Task(
        assigned_user_id=target_id,
        titre=data.titre.strip(),
        description=data.description,
        due_date=data.due_date,
        statut="todo",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id_task == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")

    if task.assigned_user_id != current_user.id_user and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Accès refusé à cette tâche.")

    payload = data.model_dump(exclude_unset=True)
    if "statut" in payload and payload["statut"] is not None:
        if payload["statut"] not in STATUTS:
            raise HTTPException(
                status_code=400,
                detail=f"Statut invalide. Valeurs acceptées : {', '.join(STATUTS)}.",
            )
        task.statut = payload["statut"]

    for field in ("titre", "description", "due_date"):
        if field in payload and payload[field] is not None:
            setattr(task, field, payload[field])

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id_task == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")

    if task.assigned_user_id != current_user.id_user and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Accès refusé à cette tâche.")

    db.delete(task)
    db.commit()
