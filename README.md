# Medicare31 — Portail de Gestion Médicale

Medicare31 est une application web full-stack sécurisée et conteneurisée, conçue pour optimiser la gestion d'un cabinet médical. L'application permet une gestion fluide des patients, des rendez-vous et de la communication interne.

**Stack Technique :**
- **Backend :** FastAPI (Python 3.11)
- **Base de Données :** PostgreSQL 15
- **Frontend :** Vanilla JS, HTML5, CSS3
- **Infrastructure :** Nginx (Reverse Proxy), Docker & Docker Compose

---

## 🚀 Fonctionnalités Principales

### 👤 Gestion des Utilisateurs & Accès
- **Système de Rôles (RBAC) :** Contrôle d'accès strict basé sur les rôles : `Administrateur`, `Médecin`, `Secrétariat` et `Patient`.
- **Authentification Sécurisée :** Utilisation de tokens **JWT (JSON Web Tokens)** avec expiration configurable (par défaut 24h) et hachage des mots de passe via **bcrypt**.
- **Profils Personnalisés :** Distinction nette entre les comptes techniques (`User`) et les profils métier (`Staff` pour le personnel, `Patient` pour les patients).

### 🏥 Gestion des Patients
- **Dossier Médical Numérique :** Centralisation des données d'identité, coordonnées et informations médicales.
- **Suivi Clinique :** Gestion des constantes vitales (taille, poids, tension), des antécédents et des allergies.
- **Numérotation Automatique :** Génération automatique de numéros de dossier uniques pour chaque patient.
- **CRUD Complet :** Interface intuitive pour créer, consulter, modifier et supprimer des fiches patients.

### 📅 Organisation & Communication
- **Agenda Médical :** Gestion des rendez-vous avec attribution de salles et types de consultation.
- **Messagerie Interne :** Système de fils de discussion sécurisés pour faciliter la communication entre le personnel et les patients.
- **Notifications & Tâches :** Dashboard professionnel avec gestion de listes de tâches et alertes.

---

## 🛠️ Architecture Technique

### 📦 Orchestration Docker
L'application est découpée en 4 services indépendants pour garantir la scalabilité et la maintenance :
- **`nginx`** : Point d'entrée unique. Gère le routage vers le frontend et l'API, et assure la sécurité via des headers HTTP durcis.
- **`frontend`** : Serveur statique haute performance distribuant l'interface utilisateur.
- **`backend`** : API REST performante gérant la logique métier et la validation des données.
- **`db`** : Base de données PostgreSQL persistante.

### 🔒 Sécurité & Robustesse
- **Protection CORS** : Restriction des requêtes API aux domaines autorisés.
- **Validation Stricte** : Utilisation de **Pydantic** pour valider chaque donnée entrante (emails, mots de passe, formats).
- **Gestion d'Erreurs** : Handler global pour intercepter les crashs et renvoyer des réponses JSON propres sans révéler d'informations sensibles.
- **Infrastructure Durcie** : 
  - Image Docker optimisée (Multi-stage build).
  - Exécution sous utilisateur non-root.
  - Compression Gzip activée via Nginx pour réduire la latence.

---

## 📂 Structure du Projet

```
Medicare31/
├── docker-compose.yml      # Orchestration des services
├── .env                   # Configuration confidentielle (non committée)
├── nginx/                 # Configuration du Reverse Proxy
├── frontend/              # Interface utilisateur (HTML/CSS/JS)
└── backend/               # API FastAPI
    ├── app/
    │   ├── main.py         # Point d'entrée et configuration globale
    │   ├── config.py       # Gestion des variables d'environnement
    │   ├── db.py           # Connexion SQLAlchemy
    │   ├── models/         # Modèles de données ORM
    │   ├── schemas/        # Validation des données (Pydantic)
    │   ├── routers/        # Endpoints de l'API
    │   └── services/       # Logique métier (Auth, Emails)
    └── Dockerfile          # Configuration du container backend
```

---

## 🚦 Lancement Rapide

### Prérequis
- Docker & Docker Compose installés.

### Installation
1. **Configurer l'environnement :**
   ```bash
   cp .env.example .env
   # Modifiez le .env avec vos identifiants
   ```

2. **Lancer l'application :**
   ```bash
   docker compose up -d --build
   ```

3. **Accès :**
   - Application : `http://localhost`
   - Documentation API (Swagger) : `http://localhost/docs`
