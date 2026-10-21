from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id_record = Column(Integer, primary_key=True, index=True)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), unique=True, nullable=False)
    antecedents = Column(Text)
    notes_cliniques = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="medical_record")


class MedicalVital(Base):
    __tablename__ = "medical_vitals"

    id_vital = Column(Integer, primary_key=True, index=True)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), nullable=False)
    taille_cm = Column(Numeric(5, 2))
    poids_kg = Column(Numeric(5, 2))
    tension_arterielle = Column(String(20))
    date_mesure = Column(DateTime, nullable=False)
    taken_by_staff_id = Column(Integer, ForeignKey("staff.id_staff"), nullable=True)
    commentaire = Column(Text)

    patient = relationship("Patient", back_populates="vitals")
    taken_by = relationship("Staff", foreign_keys=[taken_by_staff_id])


class MedicalEvent(Base):
    __tablename__ = "medical_events"

    id_event = Column(Integer, primary_key=True, index=True)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), nullable=False)
    type_event = Column(String(50))  # consultation, bilan, ordonnance, urgence, examen
    titre = Column(String(255), nullable=False)
    description = Column(Text)
    event_date = Column(DateTime, nullable=False)
    id_staff = Column(Integer, ForeignKey("staff.id_staff"), nullable=True)
    location = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())

    patient = relationship("Patient", back_populates="events")
    staff = relationship("Staff", foreign_keys=[id_staff])


class Document(Base):
    __tablename__ = "documents"

    id_document = Column(Integer, primary_key=True, index=True)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), nullable=False)
    id_uploaded_by_user = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    document_type = Column(String(50))  # analyse, ordonnance, certificat, compte_rendu
    titre = Column(String(255), nullable=False)
    fichier_url = Column(String(500), nullable=False)
    mime_type = Column(String(100))
    taille_ko = Column(Integer)
    source_label = Column(String(255))
    statut = Column(String(30), default="a_classer")  # a_classer, imprime, envoye
    document_date = Column(Date)
    created_at = Column(DateTime, server_default=func.now())

    patient = relationship("Patient", back_populates="documents")
    uploaded_by = relationship("User", foreign_keys=[id_uploaded_by_user])
