from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    titre: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_user_id: Optional[int] = None


class TaskUpdate(BaseModel):
    titre: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    statut: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskOut(BaseModel):
    id_task: int
    assigned_user_id: int
    titre: str
    description: Optional[str] = None
    statut: str
    due_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
