# Tests end-to-end

Ces tests pilotent un vrai navigateur (Chromium via Playwright) contre
l'application en fonctionnement sur `http://localhost`.

## Prérequis

L'application doit tourner :

```bash
docker compose up -d
docker compose exec backend python seed_users.py
```

Puis installer le navigateur de test (une seule fois) :

```bash
cd tests/e2e
npm install
npx playwright install chromium
```

## Exécution

```bash
cd tests/e2e
npm run smoke       # 4 rôles x 8 pages : aucune erreur JavaScript
npm run functional  # tâches, patients, navigation, arrivées, documents
npm run patients    # parcours complet de la page Patients
npm run register    # inscription d'un compte patient + e-mail de confirmation
npm run all         # tout
```

## Comptes utilisés

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Médecin | `dr.martin@medicare31.fr` | `Medecin123!` |
| Secrétariat | `secretaire.dupont@medicare31.fr` | `Secretaire123!` |
| Patient | `patient.durand@gmail.com` | `Patient123!` |
| Administrateur | `admin@medicare31.fr` | `Admin123!` |

## Ce que couvrent les tests

- **smoke.js** — chaque page est chargée pour chaque rôle : aucune erreur
  JavaScript, aucune erreur console, identité correctement affichée.
- **functional.js** — ajout/validation/suppression d'une tâche, navigation via
  la barre latérale, cloche de notifications, création d'un patient avec ses
  coordonnées, enregistrement d'une arrivée en salle d'attente, consultation
  de l'espace patient.
- **patients.js** — création d'un patient, relecture des coordonnées
  enregistrées, recherche.
- **register.js** — inscription complète en quatre étapes, vérification du
  résumé, création du compte et envoi de l'e-mail de confirmation (MailHog).

Les tests modifient les données : relancez `seed_users.py` pour repartir d'un
état propre.
