from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class CallLog(Base):
    """Journal des appels téléphoniques (accueil / secrétariat)."""

    __tablename__ = "call_logs"

    id_call = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), nullable=True)
    id_appointment = Column(Integer, ForeignKey("appointments.id_appointment"), nullable=True)
    type_appel = Column(String(30), default="entrant")  # entrant, sortant
    objet = Column(String(255), nullable=False)
    notes = Column(Text)
    statut = Column(String(30), default="a_traiter")  # a_traiter, traite
    created_by_user_id = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient")
    appointment = relationship("Appointment")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
