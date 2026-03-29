# app/services/locks.py

import redis

r = redis.Redis(host="localhost", port=6379, db=2)


def acquire_lock(key: str, ttl=120):
    return r.set(key, "1", nx=True, ex=ttl)


def release_lock(key: str):
    r.delete(key)