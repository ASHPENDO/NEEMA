from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict

from app.db.session import get_db
from app.services.ai_content_service import AIContentService

router = APIRouter(prefix="/ai", tags=["AI"])


# ==============================
# REQUEST SCHEMA
# ==============================
class AIGenerateRequest(BaseModel):
    product_id: str = Field(..., description="Product ID")
    template_id: Optional[str] = Field(None, description="Optional template ID")


# ==============================
# RESPONSE NORMALIZER (SAFE)
# ==============================
def normalize_ai_response(result: Any) -> Dict[str, Any]:
    """
    Ensures response is always structured.
    Handles:
    - New JSON format
    - Old string format (backward compatibility)
    """

    # ✅ Already structured (new system)
    if isinstance(result, dict):
        return {
            "hook": result.get("hook", ""),
            "body": result.get("body", ""),
            "cta": result.get("cta", ""),
            "hashtags": result.get("hashtags", []),
            "full_caption": result.get("full_caption")
            or f"{result.get('hook', '')}\n\n{result.get('body', '')}\n\n{result.get('cta', '')}".strip(),
        }

    # ⚠️ Old string fallback (non-breaking)
    if isinstance(result, str):
        return {
            "hook": "",
            "body": result,
            "cta": "",
            "hashtags": [],
            "full_caption": result,
        }

    # ❌ Unexpected format
    raise ValueError("Invalid AI response format")


# ==============================
# ENDPOINT (UPGRADED, NON-BREAKING)
# ==============================
@router.post("/generate")
async def generate_ai_content(
    payload: AIGenerateRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        # ==============================
        # CALL AI SERVICE
        # ==============================
        raw_result = await AIContentService.generate(
            db=db,
            product_id=payload.product_id,
            template_id=payload.template_id,
        )

        # ==============================
        # NORMALIZE OUTPUT
        # ==============================
        result = normalize_ai_response(raw_result)

        # ==============================
        # FINAL SAFETY (GUARANTEE CAPTION)
        # ==============================
        if not result.get("full_caption"):
            raise ValueError("AI failed to generate caption")

        return {
            "success": True,
            "data": result,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        # Optional: log full error server-side
        print(f"[AI ENDPOINT ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail="AI generation failed")