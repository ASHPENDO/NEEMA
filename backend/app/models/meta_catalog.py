from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MetaCatalog(Base):
    __tablename__ = "meta_catalogs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    tenant_id: Mapped[str] = mapped_column(index=True)
    business_id: Mapped[str] = mapped_column(index=True)
    catalog_id: Mapped[str] = mapped_column(index=True)
    catalog_name: Mapped[str] = mapped_column(nullable=True)