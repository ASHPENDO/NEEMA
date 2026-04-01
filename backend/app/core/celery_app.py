# app/core/celery_app.py

from celery import Celery

celery_app = Celery(
    "postika",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# 🔥 FORCE IMPORT TASKS (CRITICAL FIX)
import app.tasks.campaign_tasks  # noqa