from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    id_patient: int
    document_type: str = Field(..., max_length=50)
    titre: str = Field(..., max_length=255)
    fichier_url: str = Field(..., max_length=500)
    mime_type: Optional[str] = None
    taille_ko: Optional[int] = None
    source_label: Optional[str] = None
    document_date: Optional[date] = None


class DocumentOut(BaseModel):
    id_document: int
    id_patient: int
    patient_nom: Optional[str] = None
    document_type: str
    titre: str
    fichier_url: str
    mime_type: Optional[str] = None
    taille_ko: Optional[int] = None
    source_label: Optional[str] = None
    statut: str = "a_classer"
    document_date: Optional[date] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
