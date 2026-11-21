import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "SmartFoodChain AI API"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-smartfoodchain-change-in-production-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./smartfoodchain.db")
    ALLOWED_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]


settings = Settings()
