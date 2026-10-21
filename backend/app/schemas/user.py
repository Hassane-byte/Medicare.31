from datetime import date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Le mot de passe doit contenir au moins 8 caractères")
    nom: str
    prenom: str
    role: str = "patient"


class PatientRegister(BaseModel):
    # Identité
    civilite: Optional[str] = None
    nom: str
    prenom: str
    date_naissance: date
    sexe: Optional[str] = None
    # Compte
    email: EmailStr
    password: str = Field(..., min_length=8, description="Le mot de passe doit contenir au moins 8 caractères")
    # Coordonnées
    telephone_principal: Optional[str] = None
    telephone_secondaire: Optional[str] = None
    adresse_ligne1: Optional[str] = None
    code_postal: Optional[str] = None
    ville: Optional[str] = None
    # Sécurité
    question_secrete: Optional[str] = None
    reponse_secrete: Optional[str] = None
    # Consentements
    cgu_accepted: bool = False
    hds_consent: bool = False
    notif_email_sms_consent: bool = False


class UserOut(BaseModel):
    id_user: int
    email: str
    nom: str
    prenom: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    nom: str | None = ""
    prenom: str | None = ""


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    password: str = Field(..., min_length=8, description="Le mot de passe doit contenir au moins 8 caractères")