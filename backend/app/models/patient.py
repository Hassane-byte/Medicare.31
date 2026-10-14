from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Patient(Base):
    __tablename__ = "patients"

    id_patient = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("users.id_user"), nullable=True)
    numero_dossier = Column(String(50), unique=True, index=True, nullable=False)
    civilite = Column(String(20))
    nom = Column(String(100), nullable=False, index=True)
    prenom = Column(String(100), nullable=False, index=True)
    date_naissance = Column(Date, nullable=False)
    sexe = Column(String(30))
    # numero_securite_sociale = Column(String(30)) # REMOVED for legal reasons
    groupe_sanguin = Column(String(10))
    allergie_resume = Column(Text)
    statut_patient = Column(String(30), default="actif")  # actif, suivi, nouveau, inactif
    medecin_traitant_id = Column(Integer, ForeignKey("staff.id_staff"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="patient_profile")
    medecin_traitant = relationship(
        "Staff", back_populates="patients_traites", foreign_keys=[medecin_traitant_id]
    )
    contact = relationship("PatientContact", back_populates="patient", uselist=False)
    security = relationship("PatientSecurity", back_populates="patient", uselist=False)
    medical_record = relationship("MedicalRecord", back_populates="patient", uselist=False)
    vitals = relationship("MedicalVital", back_populates="patient")
    events = relationship("MedicalEvent", back_populates="patient")
    documents = relationship("Document", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")


class PatientContact(Base):
    __tablename__ = "patient_contacts"

    id_contact = Column(Integer, primary_key=True, index=True)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), nullable=False)
    email = Column(String(255))
    telephone_principal = Column(String(30))
    telephone_secondaire = Column(String(30))
    adresse_ligne1 = Column(String(255))
    adresse_ligne2 = Column(String(255))
    code_postal = Column(String(20))
    ville = Column(String(100))
    pays = Column(String(100), default="France")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="contact")


class PatientSecurity(Base):
    __tablename__ = "patient_security"

    id_patient_security = Column(Integer, primary_key=True, index=True)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), unique=True, nullable=False)
    question_secrete = Column(String(255))
    reponse_secrete_hash = Column(String(255))
    cgu_accepted = Column(Boolean, default=False)
    cgu_accepted_at = Column(DateTime, nullable=True)
    hds_consent = Column(Boolean, default=False)
    hds_consent_at = Column(DateTime, nullable=True)
    notif_email_sms_consent = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="security")
