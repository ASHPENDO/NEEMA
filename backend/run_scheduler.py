# run_scheduler.py

import asyncio
from app.services.scheduler import campaign_scheduler

if __name__ == "__main__":
    asyncio.run(campaign_scheduler())