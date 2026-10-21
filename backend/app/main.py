from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.db import Base, engine, SessionLocal
from app.config import settings
import app.models  # noqa: F401

from app.routers import auth, patients, messages, appointments
from app.routers import tasks, notifications, documents, medical, calls, dashboard, statistiques
from app.routers import attachments


def _seed_roles() -> None:
    """Crée les rôles par défaut s'ils n'existent pas encore."""
    from app.models.role import Role

    db = SessionLocal()
    try:
        defaults = [
            ("patient", "Patient"),
            ("medecin", "Médecin"),
            ("secretariat", "Secrétariat"),
            ("admin", "Administrateur"),
        ]
        for code, libelle in defaults:
            if not db.query(Role).filter(Role.code_role == code).first():
                db.add(Role(code_role=code, libelle=libelle))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create the schema on startup if it does not exist yet, then apply
    # the incremental migrations. Alembic should later replace this.
    from app.migrations import apply_migrations

    applied = apply_migrations()
    if applied:
        print(f"[migrations] appliquées : {', '.join(applied)}")

    _seed_roles()
    yield


app = FastAPI(title="Medicare31 API", version="1.0.0", lifespan=lifespan)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "Une erreur inattendue est survenue sur le serveur.",
            "detail": str(exc) if settings.env == "dev" else None
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(messages.router)
app.include_router(appointments.router)
app.include_router(tasks.router)
app.include_router(notifications.router)
app.include_router(documents.router)
app.include_router(medical.router)
app.include_router(calls.router)
app.include_router(dashboard.router)
app.include_router(statistiques.router)
app.include_router(attachments.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Medicare31 API"}