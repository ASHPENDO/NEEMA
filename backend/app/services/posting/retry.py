# app/services/posting/retry.py

from datetime import datetime, timezone, timedelta

MAX_RETRIES = 5
BASE_DELAY_SECONDS = 30  # 30s, 60s, 120s, 240s, ...


def compute_backoff(retry_count: int) -> timedelta:
    delay = BASE_DELAY_SECONDS * (2 ** max(0, retry_count - 1))
    return timedelta(seconds=delay)


def next_retry_time(retry_count: int) -> datetime:
    return datetime.now(timezone.utc) + compute_backoff(retry_count)


def can_retry(retry_count: int) -> bool:
    return retry_count < MAX_RETRIES