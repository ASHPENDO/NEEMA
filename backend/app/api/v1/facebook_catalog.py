from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.social_account import SocialAccount
from app.models.facebook_catalog import FacebookCatalog
from app.schemas.facebook_catalog import SyncResponse

from app.services.facebook_catalog_service import prepare_products_for_meta
from app.integrations.facebook_catalog.meta_client import (
    create_catalog,
    upload_products,
)

router = APIRouter(prefix="/facebook/catalog", tags=["facebook-catalog"])


@router.post("/sync", response_model=SyncResponse)
def sync_facebook_catalog(
    db: Session = Depends(get_db),
    tenant_id: str = "inject-from-header",
):
    try:
        # 1. Get OAuth account
        account = db.query(SocialAccount).filter(
            SocialAccount.tenant_id == tenant_id
        ).first()

        if not account:
            raise Exception("Facebook not connected")

        access_token = account.page_access_token or account.access_token

        # 2. Check catalog
        catalog = db.query(FacebookCatalog).filter(
            FacebookCatalog.tenant_id == tenant_id
        ).first()

        if not catalog:
            created = create_catalog(access_token)

            catalog = FacebookCatalog(
                tenant_id=tenant_id,
                meta_catalog_id=created["id"],
                is_connected=True,
            )

            db.add(catalog)
            db.commit()
            db.refresh(catalog)

        # 3. Prepare products
        products = prepare_products_for_meta(db, tenant_id)

        # 4. Upload
        response = upload_products(
            catalog.meta_catalog_id,
            access_token,
            products,
        )

        return SyncResponse(
            success=True,
            message=f"{len(products)} products synced",
        )

    except Exception as e:
        return SyncResponse(
            success=False,
            message=str(e),
        )