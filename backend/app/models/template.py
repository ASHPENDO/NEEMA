from sqlalchemy import Column, String, DateTime, func
from app.db.base import Base  # ✅ CORRECT IMPORT
import uuid


class Template(Base):
    __tablename__ = "templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())