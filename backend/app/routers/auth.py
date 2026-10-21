from datetime import date, datetime, timedelta
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.db import get_db
from app.models.user import User
from app.models.role import Role
from app.models.password_reset import PasswordReset
from app.schemas.user import (
    PasswordResetConfirm,
    PasswordResetRequest,
    UserCreate,
    UserOut,
    Token,
    PatientRegister,
)
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_verification_token,
    decode_verification_token,
    get_current_user,
    RoleChecker,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

STAFF_ROLES = {"medecin", "secretariat", "admin"}
admin_only = RoleChecker(["admin"])


def _normalize_role(role: str) -> str:
    role = (role or "patient").lower().strip()

    aliases = {
        "doctor": "medecin",
        "docteur": "medecin",
        "médecin": "medecin",
        "medecin": "medecin",
        "secretaria": "secretariat",
        "secretaire": "secretariat",
        "secrétaire": "secretariat",
        "secretariat": "secretariat",
        "patient": "patient",
        "admin": "admin",
    }

    return aliases.get(role, role)


def _get_role_or_404(code: str, db: Session) -> Role:
    code = _normalize_role(code)
    role = db.query(Role).filter(Role.code_role == code).first()

    if not role:
        raise HTTPException(status_code=400, detail=f"Rôle '{code}' inexistant")

    return role


def _build_token(user: User) -> dict:
    token = create_access_token({
        "sub": str(user.id_user),
        "role": user.role.code_role,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role.code_role,
        "nom": user.staff_profile.nom if user.staff_profile else (
            user.patient_profile.nom if user.patient_profile else ""
        ),
        "prenom": user.staff_profile.prenom if user.staff_profile else (
            user.patient_profile.prenom if user.patient_profile else ""
        ),
    }


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """Inscription publique : seuls les comptes patients peuvent être créés."""
    email = data.email.lower().strip()
    role_code = _normalize_role(data.role)

    if role_code != "patient":
        raise HTTPException(
            status_code=403,
            detail="Seule la création de comptes patients est autorisée via cette route.",
        )

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    role = _get_role_or_404(role_code, db)

    user = User(
        email=email,
        password_hash=hash_password(data.password),
        id_role=role.id_role,
    )

    db.add(user)
    db.flush()

    if role_code == "patient":
        from app.models.patient import Patient
        import time

        patient = Patient(
            id_user=user.id_user,
            numero_dossier=f"PAT-{int(time.time())}",
            nom=data.nom,
            prenom=data.prenom,
            date_naissance=date(2000, 1, 1),
        )
        db.add(patient)
    else:
        from app.models.staff import Staff

        staff = Staff(
            id_user=user.id_user,
            nom=data.nom,
            prenom=data.prenom,
            type_staff=role_code,
        )
        db.add(staff)

    db.commit()
    db.refresh(user)

    return {
        "id_user": user.id_user,
        "email": user.email,
        "nom": data.nom,
        "prenom": data.prenom,
        "role": role.code_role,
        "is_active": user.is_active,
    }


@router.post("/register/staff", response_model=UserOut, status_code=201)
def register_staff(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    """Création d'un membre du personnel : réservée aux administrateurs."""
    email = data.email.lower().strip()
    role_code = _normalize_role(data.role)

    if role_code not in STAFF_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Rôle invalide. Valeurs attendues : medecin, secretariat, admin.",
        )

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    role = _get_role_or_404(role_code, db)

    user = User(
        email=email,
        password_hash=hash_password(data.password),
        id_role=role.id_role,
        is_active=True,
        email_verified=True,
    )
    db.add(user)
    db.flush()

    from app.models.staff import Staff

    db.add(Staff(
        id_user=user.id_user,
        nom=data.nom,
        prenom=data.prenom,
        type_staff=role_code,
    ))

    db.commit()
    db.refresh(user)

    return {
        "id_user": user.id_user,
        "email": user.email,
        "nom": data.nom,
        "prenom": data.prenom,
        "role": role.code_role,
        "is_active": user.is_active,
    }


@router.post("/register/patient", status_code=201)
def register_patient(data: PatientRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Cette adresse e-mail est déjà utilisée.")

    role = db.query(Role).filter(Role.code_role == "patient").first()
    if not role:
        raise HTTPException(status_code=500, detail="Rôle patient introuvable.")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        id_role=role.id_role,
        is_active=False,
        email_verified=False,
    )
    db.add(user)
    db.flush()

    from app.models.patient import Patient, PatientContact, PatientSecurity
    import time

    patient = Patient(
        id_user=user.id_user,
        numero_dossier=f"PAT-{int(time.time() * 1000) % 10_000_000:07d}",
        civilite=data.civilite,
        nom=data.nom,
        prenom=data.prenom,
        date_naissance=data.date_naissance,
        sexe=data.sexe,
    )
    db.add(patient)
    db.flush()

    db.add(PatientContact(
        id_patient=patient.id_patient,
        telephone_principal=data.telephone_principal,
        telephone_secondaire=data.telephone_secondaire,
        adresse_ligne1=data.adresse_ligne1,
        code_postal=data.code_postal,
        ville=data.ville,
    ))

    db.add(PatientSecurity(
        id_patient=patient.id_patient,
        question_secrete=data.question_secrete,
        reponse_secrete_hash=hash_password(data.reponse_secrete) if data.reponse_secrete else None,
        cgu_accepted=data.cgu_accepted,
        hds_consent=data.hds_consent,
        notif_email_sms_consent=data.notif_email_sms_consent,
    ))

    db.commit()

    token = create_verification_token(user.id_user)
    try:
        from app.services.email import send_verification_email
        send_verification_email(data.email, data.prenom, token)
    except Exception:
        pass

    return {"message": "Compte créé. Vérifiez votre boîte mail pour activer votre compte."}


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)) -> RedirectResponse:
    from app.config import settings
    user_id = decode_verification_token(token)
    if user_id is None:
        return RedirectResponse(url="/login.html?error=token_invalide")


    user = db.query(User).filter(User.id_user == user_id).first()
    if not user:
        return RedirectResponse(url="/login.html?error=token_invalide")
    if user.email_verified:
        return RedirectResponse(url="/login.html?verified=already")

    user.email_verified = True
    user.is_active = True
    db.commit()
    return RedirectResponse(url="/login.html?verified=1")


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form.username.lower().strip()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    user.last_login_at = func.now()
    db.commit()
    db.refresh(user)

    return _build_token(user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    profile = current_user.staff_profile or current_user.patient_profile

    return {
        "id_user": current_user.id_user,
        "email": current_user.email,
        "nom": profile.nom if profile else "",
        "prenom": profile.prenom if profile else "",
        "role": current_user.role.code_role,
        "is_active": current_user.is_active,
    }

@router.post("/ping")
def ping(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    current_user.last_login_at = func.now()
    db.commit()

    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════
# RÉINITIALISATION DU MOT DE PASSE
# ═══════════════════════════════════════════════════════════════════

RESET_DURATION_HOURS = 2


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post("/password-reset/request")
def request_password_reset(
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """Envoie un e-mail de réinitialisation.

    La réponse est toujours identique, que l'adresse existe ou non : cela
    évite d'énumérer les comptes enregistrés.
    """
    email = data.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    message = (
        "Si un compte est associé à cette adresse, un e-mail de réinitialisation "
        "vient d'être envoyé."
    )

    if not user or not user.is_active:
        return {"message": message}

    # On invalide les demandes précédentes encore ouvertes.
    db.query(PasswordReset).filter(
        PasswordReset.id_user == user.id_user,
        PasswordReset.used.is_(False),
    ).update({"used": True}, synchronize_session=False)

    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordReset(
            id_user=user.id_user,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.utcnow() + timedelta(hours=RESET_DURATION_HOURS),
            used=False,
        )
    )
    db.commit()

    try:
        from app.services.email import send_password_reset_email

        send_password_reset_email(email, user.role.code_role, raw_token)
    except Exception as exc:  # pragma: no cover - dépend de la configuration SMTP
        print(f"[email] envoi impossible : {exc}")

    return {"message": message}


@router.get("/password-reset/validate")
def validate_password_reset(token: str, db: Session = Depends(get_db)) -> dict:
    """Vérifie qu'un jeton de réinitialisation est encore valable."""
    reset = (
        db.query(PasswordReset)
        .filter(PasswordReset.token_hash == _hash_token(token))
        .first()
    )
    if not reset or reset.used or reset.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Ce lien est invalide ou a expiré.")
    return {"valid": True}


@router.post("/password-reset/confirm")
def confirm_password_reset(
    data: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    """Applique un nouveau mot de passe."""
    reset = (
        db.query(PasswordReset)
        .filter(PasswordReset.token_hash == _hash_token(data.token))
        .first()
    )
    if not reset or reset.used or reset.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Ce lien est invalide ou a expiré.")

    user = db.query(User).filter(User.id_user == reset.id_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    user.password_hash = hash_password(data.password)
    reset.used = True
    db.commit()

    return {"message": "Mot de passe mis à jour. Vous pouvez vous connecter."}