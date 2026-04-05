# app/api/v1/endpoints/posting.py

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, get_current_user
from app.services.posting.schemas import PostPayload
from app.services.posting.service import PostService

router = APIRouter(prefix="/posting", tags=["Posting"])


# -----------------------------
# STANDARD PUBLISH (Campaign / API)
# -----------------------------
@router.post("/publish")
async def publish_post(
    payload: PostPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await PostService.publish(
        payload=payload,
        tenant_id=current_user.tenant_id,
        db=db,
    )


# -----------------------------
# MANUAL PUBLISH (CRITICAL FOR TESTING)
# -----------------------------
@router.post("/manual-publish")
async def manual_publish(
    payload: PostPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Direct publish without scheduler.
    Used for:
    - Testing PostService
    - Debugging Facebook integration
    - Immediate posting UX
    """
    return await PostService.publish(
        payload=payload,
        tenant_id=current_user.tenant_id,
        db=db,
    )