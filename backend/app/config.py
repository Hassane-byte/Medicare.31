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
    app_base_url: str = "http://localhost"

    # Production Security
    env: str = "dev"  # dev, prod
    allowed_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = {"env_file": ".env"}


settings = Settings()
