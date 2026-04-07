from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.template import Template

router = APIRouter()


@router.get("/templates/")
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template))
    templates = result.scalars().all()

    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
        }
        for t in templates
    ]