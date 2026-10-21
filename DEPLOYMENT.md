# Mise en production

Guide complet pour déployer MediCare31. L'objectif : une fois le nom de
domaine acheté, il ne reste qu'à suivre les étapes ci-dessous.

---

## 1. Prérequis

- Un serveur Linux (Ubuntu 22.04 ou Debian 12 recommandé), 2 Go de RAM minimum
- Docker Engine 24+ et le plugin Docker Compose v2
- Un nom de domaine avec une pointe DNS (A) vers l'IP du serveur
- Un compte SMTP pour l'envoi des e-mails (confirmation, mot de passe oublié)

```bash
# Vérification de l'installation
docker --version && docker compose version
```

---

## 2. Configuration

```bash
cd /opt/medicare31
cp .env.example .env
```

Renseignez `.env` :

| Variable | Valeur |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe fort, généré (`openssl rand -base64 24`) |
| `DATABASE_URL` | `postgresql://medicare_admin:<motdepasse>@db:5432/medicaredb` |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ENV` | `prod` |
| `ALLOWED_ORIGINS` | `["https://votre-domaine.fr"]` |
| `APP_BASE_URL` | `https://votre-domaine.fr` |
| `SMTP_*` | identifiants de votre serveur d'envoi |
| `SMTP_USE_TLS` | `true` |

> **La clé secrète (`SECRET_KEY`) est critique** : elle signe les jetons de
> session et les liens de vérification. Ne la changez plus après la mise en
> production, sinon toutes les sessions actives sont invalidées.

---

## 3. Premier démarrage

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Les tables et les migrations sont appliquées automatiquement au démarrage de
l'API (`backend/app/migrations.py`).

### Jeu de données initial

Le seed crée les rôles, les salles, les types de consultation, les comptes de
démonstration et des données d'exemple. **En production, créez d'abord vos
comptes réels, puis videz les données de démonstration :**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python seed_users.py
```

Comptes créés par le seed :

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@medicare31.fr` | `Admin123!` |
| Médecin | `dr.martin@medicare31.fr` | `Medecin123!` |
| Médecin | `dr.blanc@medicare31.fr` | `Medecin123!` |
| Secrétariat | `secretaire.dupont@medicare31.fr` | `Secretaire123!` |
| Patient | `patient.durand@gmail.com` | `Patient123!` |

> **Changez impérativement ces mots de passe** (voir §5) et supprimez le
> patient de démonstration une fois vos patients réels enregistrés.

---

## 4. HTTPS

Le conteneur `nginx` écoute en HTTP sur le port 80. Deux options :

**Option A — reverse-proxy externe (recommandé).** Si votre hébergeur
propose un proxy HTTPS (Traefik, Caddy, nginx du fournisseur, Cloudflare),
placez-le devant le port 80 et laissez `ALLOWED_ORIGINS` pointer sur
`https://votre-domaine.fr`.

**Option B — Let's Encrypt sur le conteneur nginx.** Ajoutez un service
`certbot` et un volume pour les certificats, puis renouvelez automatiquement :

```bash
docker run --rm -v letsencrypt:/etc/letsencrypt certbot/certbot certonly \
  --webroot -w /var/www/certbot -d votre-domaine.fr -d www.votre-domaine.fr
```

Ajoutez ensuite dans `nginx.conf` :

```nginx
server {
    listen 80;
    server_name votre-domaine.fr;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.fr;
    ssl_certificate     /etc/letsencrypt/live/votre-domaine.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.fr/privkey.pem;
    # … reprendre le bloc location / de la configuration existante …
}
```

---

## 5. Sécurité — vérifications avant l'ouverture

- [ ] `SECRET_KEY` régénérée et unique
- [ ] Mots de passe du seed modifiés (via « Mot de passe oublié » sur l'écran
      de connexion, ou en base)
- [ ] Compte patient de démonstration supprimé
- [ ] `ENV=prod` (masque le détail technique des erreurs 500)
- [ ] `ALLOWED_ORIGINS` limité à votre domaine
- [ ] Port 5432 de PostgreSQL non exposé (`docker-compose.prod.yml` s'en charge)
- [ ] MailHog absent de la pile de production (il est dans le profil `dev`)
- [ ] `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps`
      ne montre aucun port `0.0.0.0:5432`

---

## 6. Sauvegardes

```bash
./scripts/backup.sh /var/backups/medicare31
```

Sauvegarde la base (SQL compressé) et le volume des pièces jointes, et
conserve 14 générations. Planifiez-la avec cron :

```cron
0 2 * * * /opt/medicare31/scripts/backup.sh /var/backups/medicare31 >> /var/log/medicare31-backup.log 2>&1
```

Restauration :

```bash
./scripts/restore.sh /var/backups/medicare31/db-20260101-020000.sql.gz
```

---

## 7. Maintenance

```bash
# Journaux
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# Redémarrage après une modification du code
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Nettoyage des images anciennes
docker image prune -f
```

---

## 8. Vérification finale

```bash
curl -s https://votre-domaine.fr/api/health
# {"status":"ok","service":"Medicare31 API"}
```

Puis, dans le navigateur :

- inscription d'un patient depuis `/register.html` et réception de l'e-mail
  de confirmation ;
- connexion d'un patient, consultation de l'agenda et des documents ;
- connexion d'un praticien, création d'un rendez-vous et d'un patient ;
- dépôt d'une pièce jointe dans la messagerie.

Les tests automatisés (`tests/e2e/`) peuvent être rejoués contre la
production en adaptant l'URL de base.
