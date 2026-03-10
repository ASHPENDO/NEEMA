from app.integrations.social.base import BaseSocialProvider


class FacebookProvider(BaseSocialProvider):
    platform = "facebook"

    async def build_authorize_url(self, **kwargs) -> str:
        raise NotImplementedError

    async def exchange_code_for_token(self, code: str, **kwargs) -> dict:
        raise NotImplementedError

    async def refresh_access_token(self, refresh_token: str | None, **kwargs) -> dict:
        raise NotImplementedError

    async def fetch_account_profile(self, access_token: str, **kwargs) -> dict:
        raise NotImplementedError

    async def revoke_connection(self, access_token: str | None, **kwargs) -> dict:
        raise NotImplementedError