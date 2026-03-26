from app.models.catalog_item import CatalogItem


def transform_product(product):
    return {
        "id": str(product.id),
        "title": product.name,
        "description": product.description or "",
        "availability": "in stock",
        "condition": "new",
        "price": f"{product.price} KES",
        "image_link": product.image_url,
        "link": f"https://postika.app/p/{product.id}",
        "brand": "POSTIKA",
    }


def get_products(db, tenant_id):
    return db.query(CatalogItem).filter(
        CatalogItem.tenant_id == tenant_id
    ).all()


def prepare_products_for_meta(db, tenant_id):
    products = get_products(db, tenant_id)
    return [transform_product(p) for p in products]