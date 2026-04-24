# app/api/v1/ai.py

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List

from app.db.session import get_db
from app.models.tenant import Tenant
from app.services.ai_content_service import AIContentService
from app.api.deps.tenant import require_active_subscription

router = APIRouter(prefix="/ai", tags=["AI"])


# ==============================
# REQUEST SCHEMAS
# ==============================
class AIGenerateRequest(BaseModel):
    product_id: Optional[str] = Field(None, description="Single product ID")
    product_ids: Optional[List[str]] = Field(None, description="Multiple product IDs")
    template_id: Optional[str] = Field(None, description="Optional template ID")


class RegenerateRequest(BaseModel):
    product_id: Optional[str] = None
    product_ids: Optional[List[str]] = None
    section: str  # "hook" | "body" | "cta"
    context: Dict[str, Any]


# ==============================
# RESPONSE NORMALIZER
# ==============================
def normalize_ai_response(result: Any) -> Dict[str, Any]:
    """
    Ensures response is always structured.
    Handles new JSON format and old string format (backward compatibility).
    """
    if isinstance(result, dict):
        return {
            "hook": result.get("hook", ""),
            "body": result.get("body", ""),
            "cta": result.get("cta", ""),
            "hashtags": result.get("hashtags", []),
            "full_caption": result.get("full_caption")
            or f"{result.get('hook', '')}\n\n{result.get('body', '')}\n\n{result.get('cta', '')}".strip(),
        }

    if isinstance(result, str):
        return {
            "hook": "",
            "body": result,
            "cta": "",
            "hashtags": [],
            "full_caption": result,
        }

    raise ValueError("Invalid AI response format")


# ==============================
# GENERATE FULL AI CONTENT
# ==============================
@router.post("/generate")
async def generate_ai_content(
    payload: AIGenerateRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_active_subscription),  # ✅ paywall
):
    try:
        if not payload.product_id and not payload.product_ids:
            raise ValueError("At least one product is required")

        raw_result = await AIContentService.generate(
            db=db,
            product_id=payload.product_id,
            product_ids=payload.product_ids,
            template_id=payload.template_id,
        )

        result = normalize_ai_response(raw_result)

        if not result.get("full_caption"):
            raise ValueError("AI failed to generate caption")

        return {
            "success": True,
            "data": result,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        print(f"[AI ENDPOINT ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail="AI generation failed")


# ==============================
# PARTIAL REGENERATION
# ==============================
@router.post("/regenerate")
async def regenerate_section(
    payload: RegenerateRequest,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_active_subscription),  # ✅ paywall
):
    try:
        if payload.section not in {"hook", "body", "cta"}:
            raise ValueError("Invalid section. Must be 'hook', 'body', or 'cta'.")

        if not payload.product_id and not payload.product_ids:
            raise ValueError("At least one product is required")

        raw_result = await AIContentService.generate(
            db=db,
            product_id=payload.product_id,
            product_ids=payload.product_ids,
        )

        result = normalize_ai_response(raw_result)

        return {
            "success": True,
            "data": {
                payload.section: result.get(payload.section, "")
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        print(f"[AI REGENERATE ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail="AI regeneration failed")