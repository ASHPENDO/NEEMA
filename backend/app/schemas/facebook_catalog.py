from pydantic import BaseModel
from typing import Optional


class SyncResponse(BaseModel):
    success: bool
    message: str


class ConnectResponse(BaseModel):
    connected: bool
    meta_catalog_id: Optional[str]