# Medicare31 — Portail de Gestion Médicale

Medicare31 est une application web full-stack sécurisée et conteneurisée, conçue
pour optimiser la gestion d'un cabinet médical : patients, rendez-vous,
salle d'attente, messagerie sécurisée, documents et statistiques.

**Stack technique :**
- **Backend :** FastAPI (Python 3.11)
- **Base de données :** PostgreSQL 15
- **Frontend :** Vanilla JS, HTML5, CSS3
- **Infrastructure :** Nginx (reverse proxy), Docker & Docker Compose

---

## 🚀 Fonctionnalités

### 👤 Utilisateurs & accès
- **RBAC strict** : quatre rôles — `Administrateur`, `Médecin`, `Secrétariat`, `Patient` — appliqués côté API sur chaque endpoint.
- **Authentification JWT** avec expiration configurable (24 h par défaut) et mots de passe hachés en bcrypt.
- **Session** durable (« se souvenir de moi ») ou limitée au navigateur.
- **Réinitialisation de mot de passe** par e-mail, avec jeton à usage unique et expiration.

### 🏥 Patients
- Dossier administratif complet : identité, coordonnées, statut, médecin traitant.
- Constantes vitales, antécédents, événements de soins (historique médical).
- Numérotation automatique des dossiers et recherche instantanée.

### 📅 Agenda & accueil
- Agenda en vues jour / semaine / mois, avec praticiens, salles et types de consultation.
- Détection automatique des conflits de créneau et durée par défaut pilotée par le type de consultation.
- **Salle d'attente** : enregistrement d'une arrivée, suivi des patients présents.
- Statuts de rendez-vous : en attente, confirmé, annulé, terminé.

### 💬 Messagerie
- Fils de discussion un-à-un ou de groupe, avec catégories, priorité et archivage.
- Compteurs non lus, recherche dans une conversation, réponse à un message.
- **Pièces jointes** (PDF, images, Word) stockées sur volume dédié et servies de façon authentifiée.

### 📄 Documents & statistiques
- Dépôt de documents dans le dossier d'un patient, avec statut de traitement (à classer, imprimé, envoyé).
- Statistiques du cabinet : activité, répartition par statut et par type de consultation, charge par praticien, évolution sur 12 semaines.

### 🔔 Notifications & tâches
- Cloche de notifications branchée sur l'API, avec marquage lu/non lu.
- Tâches assignées, avec ajout, validation et suppression.

---

## 🛠️ Architecture

### 📦 Services Docker
| Service | Rôle |
|---|---|
| `nginx` | Point d'entrée unique : routage, en-têtes de sécurité durcis, compression |
| `frontend` | Serveur statique de l'interface |
| `backend` | API REST (FastAPI) |
| `db` | PostgreSQL, persistante |
| `mailhog` | Boîte mail de développement (absent en production) |

### 🔒 Sécurité
- CORS restreint aux origines autorisées, **Content-Security-Policy** en nginx.
- Validation systématique des entrées avec Pydantic.
- Handler global d'erreurs qui ne divulgue pas de détail technique hors développement.
- Mots de passe bcrypt, jetons JWT signés, accès aux dossiers filtrés par rôle.
- Image Docker multi-stage, exécution en utilisateur non-root, journaux bornés.

### 🗃️ Migrations
Le projet applique ses migrations au démarrage (`backend/app/migrations.py`) :
elles sont versionnées, idempotentes et enregistrées dans `schema_migrations`.

---

## 📂 Structure

```
Medicare31/
├── docker-compose.yml        # Services
├── docker-compose.prod.yml   # Surcharge production (sécurisation, santé, journaux)
├── .env.example              # Modèle de configuration
├── DEPLOYMENT.md             # Guide de mise en production
├── nginx/                    # Reverse proxy
├── scripts/                  # Sauvegarde / restauration
├── tests/e2e/                # Tests end-to-end (Playwright)
├── frontend/                 # Interface (HTML/CSS/JS)
└── backend/                  # API FastAPI
    ├── app/
    │   ├── main.py           # Point d'entrée, cycle de vie, migrations
    │   ├── config.py         # Variables d'environnement
    │   ├── db.py             # Connexion SQLAlchemy
    │   ├── migrations.py     # Migrations SQL incrémentales
    │   ├── models/           # Modèles ORM
    │   ├── schemas/          # Contrats de validation (Pydantic)
    │   ├── routers/          # Endpoints de l'API
    │   └── services/         # Auth, e-mails, règles d'accès
    ├── seed_users.py         # Jeu de données de démonstration
    └── Dockerfile
```

---

## 🚦 Démarrage

```bash
cp .env.example .env      # puis renseignez les variables
docker compose up -d --build
docker compose exec backend python seed_users.py
```

- Application : `http://localhost`
- Documentation API : `http://localhost/docs`
- Boîte mail de développement (MailHog) : `http://localhost:8025`

### Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@medicare31.fr` | `Admin123!` |
| Médecin | `dr.martin@medicare31.fr` | `Medecin123!` |
| Médecin | `dr.blanc@medicare31.fr` | `Medecin123!` |
| Secrétariat | `secretaire.dupont@medicare31.fr` | `Secretaire123!` |
| Patient | `patient.durand@gmail.com` | `Patient123!` |

### Tests

```bash
cd tests/e2e && npm install && npx playwright install chromium
npm run all
```

---

## 🚀 Mise en production

Voir **[DEPLOYMENT.md](DEPLOYMENT.md)** : configuration, HTTPS, sauvegardes,
checklist de sécurité et vérification finale.
