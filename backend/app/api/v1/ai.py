from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.services.ai_content_service import AIContentService

router = APIRouter(prefix="/ai", tags=["AI"])


# ==============================
# REQUEST SCHEMA
# ==============================
class AIGenerateRequest(BaseModel):
    product_id: str
    template_id: Optional[str] = None  # ✅ OPTIONAL


# ==============================
# ENDPOINT (FIXED)
# ==============================
@router.post("/generate")
async def generate_ai_content(
    payload: AIGenerateRequest = Body(...),  # ✅ FORCE BODY
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await AIContentService.generate(
            db=db,
            product_id=payload.product_id,
            template_id=payload.template_id,
        )

        return {"data": result}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))