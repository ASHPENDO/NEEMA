from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL_ASYNC: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postika"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/postika"

settings = Settings()
