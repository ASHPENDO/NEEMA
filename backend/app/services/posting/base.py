# app/services/posting/base.py

from abc import ABC, abstractmethod


class BasePlatformPoster(ABC):

    @abstractmethod
    async def post(self, payload, social_account):
        pass