from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    id_user: int
    type_notification: str = "systeme"
    titre: str = Field(..., max_length=255)
    contenu: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None


class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None


class NotificationOut(BaseModel):
    id_notification: int
    type_notification: str
    titre: str
    contenu: Optional[str] = None
    is_read: bool
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
