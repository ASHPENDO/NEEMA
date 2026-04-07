from pydantic import BaseModel
from typing import Optional


class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None


class TemplateCreate(TemplateBase):
    pass


class TemplateOut(TemplateBase):
    id: str

    class Config:
        from_attributes = True