from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CallCreate(BaseModel):
    id_patient: Optional[int] = None
    id_appointment: Optional[int] = None
    type_appel: str = "entrant"
    objet: str = Field(..., max_length=255)
    notes: Optional[str] = None


class CallUpdate(BaseModel):
    objet: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    statut: Optional[str] = None
    id_patient: Optional[int] = None
    id_appointment: Optional[int] = None


class CallOut(BaseModel):
    id_call: int
    id_patient: Optional[int] = None
    patient_nom: Optional[str] = None
    id_appointment: Optional[int] = None
    type_appel: str
    objet: str
    notes: Optional[str] = None
    statut: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
