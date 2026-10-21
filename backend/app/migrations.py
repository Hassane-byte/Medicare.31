"""Migrations SQL incrémentales, appliquées au démarrage de l'API.

Le projet n'utilise pas encore Alembic : les changements de schéma sont donc
déclarés ici sous forme de SQL brut. Chaque migration est enregistrée dans la
table `schema_migrations` et n'est appliquée qu'une seule fois.

Pour ajouter une migration :
1. écrire la requête SQL dans MIGRATIONS avec un identifiant unique ;
2. ne jamais modifier une migration déjà appliquée, en ajouter une nouvelle.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import Base, engine

MIGRATIONS = [
    (
        "001_appointment_checked_in_at",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP",
    ),
    (
        "002_document_statut",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS statut VARCHAR(30) DEFAULT 'a_classer'",
    ),
    (
        "003_call_logs_table",
        """
        CREATE TABLE IF NOT EXISTS call_logs (
            id_call SERIAL PRIMARY KEY,
            id_user INTEGER NOT NULL REFERENCES users(id_user),
            id_patient INTEGER REFERENCES patients(id_patient),
            id_appointment INTEGER REFERENCES appointments(id_appointment),
            type_appel VARCHAR(30) DEFAULT 'entrant',
            objet VARCHAR(255) NOT NULL,
            notes TEXT,
            statut VARCHAR(30) DEFAULT 'a_traiter',
            created_by_user_id INTEGER NOT NULL REFERENCES users(id_user),
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now()
        )
        """,
    ),
    (
        "004_password_resets_table",
        """
        CREATE TABLE IF NOT EXISTS password_resets (
            id_reset SERIAL PRIMARY KEY,
            id_user INTEGER NOT NULL REFERENCES users(id_user),
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT now()
        )
        """,
    ),
]


def _ensure_migration_table(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id_migration VARCHAR(100) PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT now()
            )
            """
        )
    )
    db.commit()


def apply_migrations() -> list[str]:
    """Applique les migrations en attente. Retourne la liste des appliquées."""
    Base.metadata.create_all(bind=engine)

    applied: list[str] = []
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id_migration VARCHAR(100) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT now()
                )
                """
            )
        )
        done = {
            row[0]
            for row in conn.execute(text("SELECT id_migration FROM schema_migrations"))
        }

        for name, sql in MIGRATIONS:
            if name in done:
                continue
            conn.execute(text(sql))
            conn.execute(
                text("INSERT INTO schema_migrations (id_migration) VALUES (:name)"),
                {"name": name},
            )
            applied.append(name)

    return applied
