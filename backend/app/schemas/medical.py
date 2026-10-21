from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VitalIn(BaseModel):
    taille_cm: Optional[float] = None
    poids_kg: Optional[float] = None
    tension_arterielle: Optional[str] = None
    date_mesure: Optional[datetime] = None
    commentaire: Optional[str] = None


class VitalOut(BaseModel):
    id_vital: int
    id_patient: int
    taille_cm: Optional[float] = None
    poids_kg: Optional[float] = None
    tension_arterielle: Optional[str] = None
    date_mesure: datetime
    taken_by_staff_id: Optional[int] = None
    commentaire: Optional[str] = None

    model_config = {"from_attributes": True}


class RecordIn(BaseModel):
    antecedents: Optional[str] = None
    notes_cliniques: Optional[str] = None


class RecordOut(BaseModel):
    id_record: int
    id_patient: int
    antecedents: Optional[str] = None
    notes_cliniques: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EventIn(BaseModel):
    type_event: str = Field(..., max_length=50)
    titre: str = Field(..., max_length=255)
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    id_staff: Optional[int] = None
    location: Optional[str] = None


class EventOut(BaseModel):
    id_event: int
    id_patient: int
    type_event: str
    titre: str
    description: Optional[str] = None
    event_date: datetime
    id_staff: Optional[int] = None
    staff_nom: Optional[str] = None
    location: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
