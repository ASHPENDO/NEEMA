from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # When running from backend/, this will find backend/.env
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL_ASYNC: str
    DATABASE_URL_SYNC: str

    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60


settings = Settings()
