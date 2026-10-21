"""
Script de seed : crée les rôles et un jeu de données de démonstration complet
(médecin, secrétaire, patients, rendez-vous, messages, tâches, documents...).

Usage : docker compose exec backend python seed_users.py
Le script est idempotent : les données déjà présentes ne sont pas dupliquées.
"""
import sys
import os
from datetime import date, datetime, time, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.db import SessionLocal, engine, Base
import app.models  # noqa: F401  (enregistre toutes les tables sur Base.metadata)
from app.models.role import Role
from app.models.user import User
from app.models.staff import Staff
from app.models.patient import Patient, PatientContact
from app.models.room import Room, AppointmentType
from app.models.appointment import Appointment
from app.models.medical import (
    MedicalRecord,
    MedicalVital,
    MedicalEvent,
    Document,
)
from app.models.message import (
    ConversationThread,
    ConversationParticipant,
    Message,
)
from app.models.notification import Notification
from app.models.task import Task
from app.models.call_log import CallLog
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
            "nom": "Administrateur",
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
        "role_code": "medecin",
        "email": "dr.blanc@medicare31.fr",
        "password": "Medecin123!",
        "staff": {
            "type_staff": "medecin",
            "civilite": "Dr",
            "nom": "Blanc",
            "prenom": "Karim",
            "specialite": "Cardiologie",
            "telephone": "0561000003",
            "couleur_agenda": "#2196F3",
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
            "couleur_agenda": "#F59E0B",
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
            "statut_patient": "actif",
            "medecin_traitant_id": 2,
        },
        "contact": {
            "email": "patient.durand@gmail.com",
            "telephone_principal": "0612345678",
            "telephone_secondaire": "0561000009",
            "adresse_ligne1": "14 rue des Lilas",
            "code_postal": "31200",
            "ville": "Toulouse",
            "pays": "France",
        },
    },
]

# Patients de démonstration (dossiers + coordonnées, sans compte utilisateur)
EXTRA_PATIENTS = [
    ("PAT-2026-002", "Mme", "Robert", "Alain", date(1962, 7, 28), "Masculin", "suivi", 2, "0612000011", "12 chemin des Vignes", "31600", "Muret"),
    ("PAT-2026-003", "M", "Lefevre", "Julie", date(1979, 11, 3), "Feminin", "actif", 2, "0612000012", "5 impasse Bellevue", "31300", "Blagnac"),
    ("PAT-2026-004", "M", "Karim", "Nadia", date(1994, 2, 19), "Feminin", "nouveau", 3, "0612000013", "21 boulevard Carnot", "31200", "Toulouse"),
    ("PAT-2026-005", "M", "Moreau", "Laura", date(1988, 4, 22), "Feminin", "actif", 2, "0612000014", "8 rue des Otages", "31320", "Castanet-Tolosan"),
    ("PAT-2026-006", "M", "Lambert", "Thomas", date(1955, 12, 8), "Masculin", "suivi", 2, "0612000015", "45 route de Blagnac", "31200", "Toulouse"),
    ("PAT-2026-007", "Mme", "Petit", "Nathalie", date(1970, 9, 14), "Feminin", "actif", 3, "0612000016", "3 allee des Lilas", "31800", "Saint-Orens"),
    ("PAT-2026-008", "M", "Bernard", "Paul", date(2001, 6, 30), "Masculin", "inactif", 2, "0612000017", "17 avenue de Muret", "31200", "Toulouse"),
    ("PAT-2026-009", "Mme", "Garcia", "Sylvie", date(1966, 3, 5), "Feminin", "suivi", 3, "0612000018", "6 rue du Taur", "31000", "Toulouse"),
]

TASKS_TO_CREATE = [
    ("medecin", "Appeler M. Bernard pour ses résultats", "todo", 1),
    ("medecin", "Préparer les ordonnances de la semaine", "todo", 2),
    ("medecin", "Relire les comptes-rendus de consultation", "done", None),
    ("secretariat", "Rappeler les patients de demain", "todo", 1),
    ("secretariat", "Scanner les documents reçus", "todo", 3),
    ("secretariat", "Préparer la salle d'attente", "done", None),
]

CALLS_TO_CREATE = [
    ("Rappeler pour résultats", "Patient a demandé un rappel des analyses.", "a_traiter", "entrant"),
    ("Demande de rendez-vous urgent", "Douleur thoracique, orientation urgente.", "a_traiter", "entrant"),
    ("Confirmation de rendez-vous", "Rendez-vous de la semaine prochaine confirmé.", "traite", "sortant"),
    ("Question administrative", "Demande d'attestation de droits.", "traite", "entrant"),
]

DOCUMENTS_TO_CREATE = [
    ("analyse", "Résultats d'analyses sanguines", "Laboratoire Cerba", 245, "patient"),
    ("ordonnance", "Ordonnance de traitement", "Dr. Sophie Martin", 82, "patient"),
    ("certificat", "Certificat médical", "Dr. Sophie Martin", 64, "patient"),
    ("compte_rendu", "Compte-rendu de consultation", "Dr. Karim Blanc", 128, "patient"),
]

NOTIFICATIONS_TO_CREATE = [
    ("rappel_rdv", "Rappel de rendez-vous", "Vous avez un rendez-vous demain à 09:00.", "systeme"),
    ("message", "Nouveau message", "Le secrétariat vous a envoyé un message.", "message"),
    ("document", "Document disponible", "Un compte-rendu a été ajouté à votre dossier.", "document"),
]


def _at(day_offset: int, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(date.today() + timedelta(days=day_offset), time(hour, minute))


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
                    contact = entry["contact"]
                    patient_contact = PatientContact(
                        id_patient=patient.id_patient,
                        **contact,
                    )
                    db.add(patient_contact)

            db.commit()
            print(f"  [OK] {entry['email']} ({entry['role_code']}) créé")

        # ── Patients supplémentaires ────────────────────────────────────────
        print("\n--- Dossiers patients de démonstration ---")
        for (
            numero, civilite, nom, prenom, ddn, sexe, statut, medecin_id,
            tel, adresse, cp, ville,
        ) in EXTRA_PATIENTS:
            existing = db.query(Patient).filter(Patient.numero_dossier == numero).first()
            if existing:
                continue
            patient = Patient(
                numero_dossier=numero,
                civilite=civilite,
                nom=nom,
                prenom=prenom,
                date_naissance=ddn,
                sexe=sexe,
                statut_patient=statut,
                medecin_traitant_id=medecin_id,
            )
            db.add(patient)
            db.flush()
            db.add(
                PatientContact(
                    id_patient=patient.id_patient,
                    email=f"{prenom.lower()}.{nom.lower()}@exemple.fr",
                    telephone_principal=tel,
                    adresse_ligne1=adresse,
                    code_postal=cp,
                    ville=ville,
                    pays="France",
                )
            )
            print(f"  [OK] {numero} — {prenom} {nom}")
        db.commit()

        patients = db.query(Patient).order_by(Patient.id_patient).all()
        rooms = db.query(Room).order_by(Room.id_room).all()
        types = db.query(AppointmentType).order_by(AppointmentType.id_appointment_type).all()
        staff = db.query(Staff).order_by(Staff.id_staff).all()
        medecins = [s for s in staff if s.type_staff == "medecin"]
        secretariat = db.query(Staff).filter(Staff.type_staff == "secretariat").first()
        admin_user = db.query(User).filter(User.email == "admin@medicare31.fr").first()
        secretariat_user = db.query(User).filter(
            User.email == "secretaire.dupont@medicare31.fr"
        ).first()
        medecin_user = db.query(User).filter(User.email == "dr.martin@medicare31.fr").first()
        patient_user = db.query(User).filter(User.email == "patient.durand@gmail.com").first()
        patient_durand = db.query(Patient).filter(
            Patient.numero_dossier == "PAT-2026-001"
        ).first()

        # ── Rendez-vous ────────────────────────────────────────────────────
        print("\n--- Rendez-vous ---")
        if not db.query(Appointment).count():
            rdvs = [
                # (patient, staff, type, jour, heure, durée, statut, check-in)
                (0, 0, 0, 0, 9, 30, "confirme", None),
                (1, 0, 1, 0, 9, 30, "en_attente", True),
                (2, 0, 4, 0, 10, 15, "confirme", True),
                (3, 1, 2, 0, 10, 30, "en_attente", True),
                (4, 0, 0, 0, 11, 30, "confirme", None),
                (5, 1, 3, 0, 14, 0, "en_attente", None),
                (6, 0, 5, 0, 15, 30, "confirme", None),
                (7, 1, 0, 0, 16, 0, "en_attente", None),
                (0, 0, 0, 1, 9, 0, "confirme", None),
                (1, 0, 1, 1, 10, 0, "en_attente", None),
                (2, 1, 2, 1, 11, 0, "confirme", None),
                (3, 0, 6, 2, 9, 30, "confirme", None),
                (4, 0, 0, 3, 14, 0, "en_attente", None),
                (5, 1, 3, 4, 10, 30, "confirme", None),
                (0, 0, 0, -7, 10, 0, "termine", None),
                (1, 0, 2, -14, 9, 30, "termine", None),
                (2, 1, 0, -21, 15, 0, "annule", None),
                (3, 0, 1, -30, 11, 0, "termine", None),
            ]
            for (
                p_idx, s_idx, t_idx, day, hour, minute, statut, checked_in
            ) in rdvs:
                patient = patients[p_idx]
                s = medecins[s_idx] if s_idx < len(medecins) else medecins[0]
                t = types[t_idx]
                room = rooms[(p_idx + day) % len(rooms)]
                start = _at(day, hour, minute)
                end = start + timedelta(minutes=t.duree_par_defaut_min)
                appt = Appointment(
                    id_patient=patient.id_patient,
                    id_staff=s.id_staff,
                    id_room=room.id_room,
                    id_appointment_type=t.id_appointment_type,
                    start_at=start,
                    end_at=end,
                    statut=statut,
                    couleur="blue",
                    notes="",
                    created_by_user_id=(
                        secretariat_user.id_user
                        if secretariat_user
                        else admin_user.id_user
                    ),
                    checked_in_at=(
                        start - timedelta(minutes=5) if checked_in else None
                    ),
                )
                db.add(appt)
            db.commit()
            print(f"  [OK] {len(rdvs)} rendez-vous créés")
        else:
            print("  [SKIP] des rendez-vous existent déjà")

        # ── Tâches ─────────────────────────────────────────────────────────
        print("\n--- Tâches ---")
        if not db.query(Task).count():
            for role_email, titre, statut, due in TASKS_TO_CREATE:
                email = (
                    "dr.martin@medicare31.fr"
                    if role_email == "medecin"
                    else "secretaire.dupont@medicare31.fr"
                )
                user = db.query(User).filter(User.email == email).first()
                if not user:
                    continue
                db.add(
                    Task(
                        assigned_user_id=user.id_user,
                        titre=titre,
                        statut=statut,
                        due_date=_at(due, 17, 0) if due else None,
                    )
                )
            db.commit()
            print(f"  [OK] {len(TASKS_TO_CREATE)} tâches créées")
        else:
            print("  [SKIP] des tâches existent déjà")

        # ── Journal des appels ─────────────────────────────────────────────
        print("\n--- Journal des appels ---")
        if not db.query(CallLog).count():
            for objet, notes, statut, type_appel in CALLS_TO_CREATE:
                db.add(
                    CallLog(
                        id_user=secretariat_user.id_user if secretariat_user else None,
                        id_patient=patients[1].id_patient,
                        type_appel=type_appel,
                        objet=objet,
                        notes=notes,
                        statut=statut,
                        created_by_user_id=(
                            secretariat_user.id_user
                            if secretariat_user
                            else admin_user.id_user
                        ),
                    )
                )
            db.commit()
            print(f"  [OK] {len(CALLS_TO_CREATE)} appels créés")
        else:
            print("  [SKIP] des appels existent déjà")

        # ── Dossier médical du patient de démonstration ─────────────────────
        print("\n--- Dossier médical ---")
        if patient_durand:
            if not db.query(MedicalVital).filter(
                MedicalVital.id_patient == patient_durand.id_patient
            ).count():
                db.add_all([
                    MedicalVital(
                        id_patient=patient_durand.id_patient,
                        taille_cm=178.0,
                        poids_kg=82.5,
                        tension_arterielle="128/82",
                        date_mesure=_at(-30, 10),
                        taken_by_staff_id=medecins[0].id_staff,
                        commentaire="Mesure de routine.",
                    ),
                    MedicalVital(
                        id_patient=patient_durand.id_patient,
                        taille_cm=178.0,
                        poids_kg=80.0,
                        tension_arterielle="125/80",
                        date_mesure=_at(-90, 10),
                        taken_by_staff_id=medecins[0].id_staff,
                        commentaire="",
                    ),
                ])
            if not db.query(MedicalRecord).filter(
                MedicalRecord.id_patient == patient_durand.id_patient
            ).count():
                db.add(
                    MedicalRecord(
                        id_patient=patient_durand.id_patient,
                        antecedents="Hypertension légère. Tabagisme arrêté en 2019.",
                        notes_cliniques="Suivi annuel. Dernier bilan sanguin normal.",
                    )
                )
            if not db.query(MedicalEvent).filter(
                MedicalEvent.id_patient == patient_durand.id_patient
            ).count():
                for (
                    type_event, titre, description, day, staff_idx
                ) in [
                    ("consultation", "Consultation générale", "Point de situation annuel.", -30, 0),
                    ("bilan", "Bilan biologique", "Glycémie et cholestérol dans la norme.", -60, 0),
                    ("consultation", "Renouvellement ordonnance", "Poursuite du traitement.", -95, 1),
                    ("examen", "ECG de contrôle", "Tracé normal.", -120, 0),
                ]:
                    s = medecins[staff_idx] if staff_idx < len(medecins) else medecins[0]
                    db.add(
                        MedicalEvent(
                            id_patient=patient_durand.id_patient,
                            type_event=type_event,
                            titre=titre,
                            description=description,
                            event_date=_at(day, 10),
                            id_staff=s.id_staff,
                            location="Cabinet 1",
                        )
                    )
            db.commit()
            print("  [OK] dossier médical du patient")

            # ── Documents ───────────────────────────────────────────────────
            print("\n--- Documents ---")
            if not db.query(Document).filter(
                Document.id_patient == patient_durand.id_patient
            ).count():
                for doc_type, titre, source, taille, _ in DOCUMENTS_TO_CREATE:
                    db.add(
                        Document(
                            id_patient=patient_durand.id_patient,
                            id_uploaded_by_user=(
                                medecin_user.id_user if medecin_user else admin_user.id_user
                            ),
                            document_type=doc_type,
                            titre=titre,
                            fichier_url=f"/documents/{patient_durand.id_patient}/{titre.lower().replace(' ', '-')}.pdf",
                            mime_type="application/pdf",
                            taille_ko=taille,
                            source_label=source,
                            statut="a_classer" if doc_type == "analyse" else "envoye",
                            document_date=date.today() - timedelta(days=30),
                        )
                    )
                db.commit()
                print(f"  [OK] {len(DOCUMENTS_TO_CREATE)} documents créés")
            else:
                print("  [SKIP] des documents existent déjà")

        # ── Notifications ──────────────────────────────────────────────────
        print("\n--- Notifications ---")
        if not db.query(Notification).count():
            for target, type_notif, titre, contenu in [
                (medecin_user, "rappel_rdv", "Rappel de rendez-vous", "Un patient a un rendez-vous à 09:00."),
                (medecin_user, "message", "Nouveau message", "Le secrétariat vous a envoyé un message."),
                (medecin_user, "systeme", "Stock faible", "Le stock d'ordonnances est presque épuisé."),
                (secretariat_user, "rappel_rdv", "Demandes à confirmer", "3 demandes de rendez-vous attendent une confirmation."),
                (secretariat_user, "document", "Documents à classer", "Des documents sont en attente de classement."),
                (patient_user, "rappel_rdv", "Rappel de rendez-vous", "Vous avez un rendez-vous demain à 09:00."),
                (patient_user, "document", "Document disponible", "Un compte-rendu a été ajouté à votre dossier."),
            ]:
                if not target:
                    continue
                db.add(
                    Notification(
                        id_user=target.id_user,
                        type_notification=type_notif,
                        titre=titre,
                        contenu=contenu,
                        is_read=False,
                    )
                )
            db.commit()
            print("  [OK] notifications créées")
        else:
            print("  [SKIP] des notifications existent déjà")

        # ── Messagerie ─────────────────────────────────────────────────────
        print("\n--- Messagerie ---")
        if not db.query(ConversationThread).count():
            conversations = [
                (
                    "Résultats de vos analyses",
                    medecin_user,
                    patient_user,
                    [
                        (medecin_user, "Bonjour, vos résultats sont arrivés. Tout est dans la norme."),
                        (patient_user, "Merci docteur, bonne journée."),
                    ],
                ),
                (
                    "Demande de rendez-vous",
                    secretariat_user,
                    patient_user,
                    [
                        (patient_user, "Bonjour, je souhaite un rendez-vous pour un contrôle."),
                        (secretariat_user, "Bonjour, je vous propose jeudi à 10h00."),
                    ],
                ),
                (
                    "Réunion d'équipe",
                    admin_user,
                    medecin_user,
                    [
                        (admin_user, "Réunion de cabinet demain à 7h30 en salle de réunion."),
                    ],
                ),
            ]
            for sujet, creator, recipient, messages in conversations:
                thread = ConversationThread(
                    sujet=sujet,
                    category="patients" if patient_user in (creator, recipient) else "equipe",
                    priority="normal",
                    is_archived=False,
                    created_by_user_id=creator.id_user,
                )
                db.add(thread)
                db.flush()
                # On garde les références : la session est en autoflush=False,
                # les participants ne seraient pas encore en base lors d'un SELECT.
                part_creator = ConversationParticipant(
                    id_thread=thread.id_thread,
                    id_user=creator.id_user,
                    role_in_thread="sender",
                    unread_count=0,
                )
                part_recipient = ConversationParticipant(
                    id_thread=thread.id_thread,
                    id_user=recipient.id_user,
                    role_in_thread="recipient",
                    unread_count=0,
                )
                db.add(part_creator)
                db.add(part_recipient)
                for index, (sender, body) in enumerate(messages):
                    db.add(
                        Message(
                            id_thread=thread.id_thread,
                            sender_user_id=sender.id_user,
                            body=body,
                            sent_at=_at(-1, 9, 15 + index * 5),
                            is_urgent=False,
                        )
                    )
                    # Le message est non lu pour le participant qui ne l'a pas envoyé.
                    other_part = (
                        part_recipient if sender.id_user == creator.id_user else part_creator
                    )
                    other_part.unread_count = (other_part.unread_count or 0) + 1
            db.commit()
            print(f"  [OK] {len(conversations)} conversations créées")
        else:
            print("  [SKIP] des conversations existent déjà")

    except Exception as exc:
        db.rollback()
        print(f"[ERREUR FATALE] {exc}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("=== Seed Medicare31 ===")
    seed()
    print("=== Terminé ===")
