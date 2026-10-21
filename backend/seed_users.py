"""
Script de seed : crée les rôles et des utilisateurs (médecin, secrétaire, patient) en BDD.
Usage : docker compose exec backend python seed_users.py
"""
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))

from app.db import SessionLocal, engine, Base
import app.models  # noqa: F401  (enregistre toutes les tables sur Base.metadata)
from app.models.role import Role
from app.models.user import User
from app.models.staff import Staff
from app.models.patient import Patient, PatientContact
from app.models.room import Room, AppointmentType
from app.services.auth import hash_password

ROOMS_TO_CREATE = ["Cabinet 1", "Cabinet 2", "Salle de téléconsultation"]

TYPES_TO_CREATE = [
    ("Consultation générale", 30),
    ("Contrôle annuel", 30),
    ("Suivi diabète", 45),
    ("Suivi cholestérol", 30),
    ("Urgence", 15),
    ("Téléconsultation", 30),
    ("Renouvellement ordonnance", 15),
]

# On définit les rôles obligatoires
ROLES_TO_CREATE = ["admin", "medecin", "secretariat", "patient"]

ROLE_LABELS = {
    "admin": "Administrateur",
    "medecin": "Médecin",
    "secretariat": "Secrétariat",
    "patient": "Patient",
}

USERS_TO_CREATE = [
    {
        "role_code": "admin",
        "email": "admin@medicare31.fr",
        "password": "Admin123!",
        "staff": {
            "type_staff": "admin",
            "civilite": "M.",
            "nom": "Admin",
            "prenom": "Système",
            "specialite": None,
            "telephone": None,
            "couleur_agenda": "#9C27B0",
        },
    },
    {
        "role_code": "medecin",
        "email": "dr.martin@medicare31.fr",
        "password": "Medecin123!",
        "staff": {
            "type_staff": "medecin",
            "civilite": "Dr",
            "nom": "Martin",
            "prenom": "Sophie",
            "specialite": "Médecine générale",
            "telephone": "0561000001",
            "couleur_agenda": "#4CAF50",
        },
    },
    {
        "role_code": "secretariat",
        "email": "secretaire.dupont@medicare31.fr",
        "password": "Secretaire123!",
        "staff": {
            "type_staff": "secretariat",
            "civilite": "Mme",
            "nom": "Dupont",
            "prenom": "Claire",
            "specialite": None,
            "telephone": "0561000002",
            "couleur_agenda": "#2196F3",
        },
    },
    {
        "role_code": "patient",
        "email": "patient.durand@gmail.com",
        "password": "Patient123!",
        "patient": {
            "numero_dossier": "PAT-2026-001",
            "civilite": "M",
            "nom": "Durand",
            "prenom": "Jean",
            "date_naissance": date(1985, 6, 15),
            "sexe": "Masculin",
            "statut_patient": "nouveau",
        },
        "contact": {
            "email": "patient.durand@gmail.com",
            "telephone_principal": "0612345678",
            "ville": "Toulouse",
            "code_postal": "31000",
            "pays": "France",
        },
    },
]

def seed():
    print("--- Création des tables si nécessaire ---")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("--- Initialisation des rôles ---")
        for code in ROLES_TO_CREATE:
            role = db.query(Role).filter(Role.code_role == code).first()
            if not role:
                print(f"  Création du rôle : {code}")
                db.add(Role(code_role=code, libelle=ROLE_LABELS.get(code)))
        db.commit()

        print("\n--- Initialisation des salles et types de consultation ---")
        for nom in ROOMS_TO_CREATE:
            if not db.query(Room).filter(Room.nom == nom).first():
                print(f"  Création de la salle : {nom}")
                db.add(Room(nom=nom))
        for libelle, duree in TYPES_TO_CREATE:
            if not db.query(AppointmentType).filter(AppointmentType.libelle == libelle).first():
                print(f"  Création du type : {libelle}")
                db.add(AppointmentType(libelle=libelle, duree_par_defaut_min=duree))
        db.commit()

        print("\n--- Création des utilisateurs ---")
        for entry in USERS_TO_CREATE:
            if db.query(User).filter(User.email == entry["email"]).first():
                print(f"  [SKIP] {entry['email']} existe déjà")
                continue

            role = db.query(Role).filter(Role.code_role == entry["role_code"]).first()
            if not role:
                print(f"  [ERREUR] Rôle '{entry['role_code']}' introuvable")
                continue

            user = User(
                id_role=role.id_role,
                email=entry["email"],
                password_hash=hash_password(entry["password"]),
                is_active=True,
                email_verified=True,
            )
            db.add(user)
            db.flush()

            if "staff" in entry:
                s = entry["staff"]
                staff = Staff(
                    id_user=user.id_user,
                    type_staff=s["type_staff"],
                    civilite=s["civilite"],
                    nom=s["nom"],
                    prenom=s["prenom"],
                    specialite=s.get("specialite"),
                    telephone=s.get("telephone"),
                    couleur_agenda=s.get("couleur_agenda"),
                )
                db.add(staff)

            if "patient" in entry:
                p = entry["patient"]
                patient = Patient(
                    id_user=user.id_user,
                    **p,
                )
                db.add(patient)
                db.flush()

                if "contact" in entry:
                    contact = PatientContact(
                        id_patient=patient.id_patient,
                        **entry["contact"],
                    )
                    db.add(contact)

            db.commit()
            print(f"  [OK] {entry['email']} ({entry['role_code']}) créé")

    except Exception as exc:
        db.rollback()
        print(f"[ERREUR FATALE] {exc}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("=== Seed utilisateurs Medicare31 ===")
    seed()
    print("=== Terminé ===")
