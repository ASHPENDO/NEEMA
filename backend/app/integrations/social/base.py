from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseSocialProvider(ABC):
    platform: str

    @abstractmethod
    async def build_authorize_url(self, **kwargs) -> str:
        raise NotImplementedError

    @abstractmethod
    async def exchange_code_for_token(self, code: str, **kwargs) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str | None, **kwargs) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def fetch_account_profile(self, access_token: str, **kwargs) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def revoke_connection(self, access_token: str | None, **kwargs) -> dict[str, Any]:
        raise NotImplementedError