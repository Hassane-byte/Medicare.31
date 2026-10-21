from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str = Field(..., min_length=32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_from: str = "noreply@medicare31.fr"
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    app_base_url: str = "http://localhost"

    # Production Security
    env: str = "dev"  # dev, prod
    allowed_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Stockage des pièces jointes de la messagerie
    upload_dir: str = "uploads"
    max_upload_kb: int = 10 * 1024
    allowed_upload_types: List[str] = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }



settings = Settings()
