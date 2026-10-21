from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id_appointment = Column(Integer, primary_key=True, index=True)
    id_patient = Column(Integer, ForeignKey("patients.id_patient"), nullable=False)
    id_staff = Column(Integer, ForeignKey("staff.id_staff"), nullable=False)
    id_room = Column(Integer, ForeignKey("rooms.id_room"), nullable=True)
    id_appointment_type = Column(
        Integer, ForeignKey("appointment_types.id_appointment_type"), nullable=True
    )
    statut = Column(String(30), default="en_attente")  # confirmé, en_attente, annulé, terminé
    couleur = Column(String(20))
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    notes = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    updated_by_user_id = Column(Integer, ForeignKey("users.id_user"), nullable=True)
    checked_in_at = Column(DateTime, nullable=True)  # arrivée du patient (salle d'attente)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="appointments")
    staff = relationship("Staff", back_populates="appointments", foreign_keys=[id_staff])
    room = relationship("Room", foreign_keys=[id_room])
    appointment_type = relationship("AppointmentType", foreign_keys=[id_appointment_type])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    updated_by = relationship("User", foreign_keys=[updated_by_user_id])
