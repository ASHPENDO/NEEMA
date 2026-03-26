import requests

GRAPH_URL = "https://graph.facebook.com/v19.0"


def create_catalog(access_token):
    # Get business
    resp = requests.get(
        f"{GRAPH_URL}/me/businesses",
        params={"access_token": access_token},
    ).json()

    businesses = resp.get("data", [])
    if not businesses:
        raise Exception("No business found")

    business_id = businesses[0]["id"]

    # Create catalog
    response = requests.post(
        f"{GRAPH_URL}/{business_id}/owned_product_catalogs",
        data={
            "name": "Postika Catalog",
            "access_token": access_token,
        },
    ).json()

    return response


def upload_products(catalog_id, access_token, products):
    url = f"{GRAPH_URL}/{catalog_id}/batch"

    payload = {
        "access_token": access_token,
        "requests": [
            {
                "method": "CREATE",
                "retailer_id": p["id"],
                "data": p,
            }
            for p in products
        ],
    }

    response = requests.post(url, json=payload)
    return response.json()