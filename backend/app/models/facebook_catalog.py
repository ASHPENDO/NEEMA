from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.db.base import Base


class FacebookCatalog(Base):
    __tablename__ = "facebook_catalogs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)

    meta_catalog_id = Column(String, nullable=True)
    is_connected = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)