# backend/scripts/test_payment.py

import asyncio
from decimal import Decimal

from app.db.session import async_session_maker  # ✅ FIXED
from app.services.payments import handle_subscription_payment_success

TENANT_ID = "0cd262a9-dd26-4aae-853a-5bde9a149414"  # ✅ CORRECT TENANT


async def main():
    async with async_session_maker() as db:
        await handle_subscription_payment_success(
            db=db,
            tenant_id=TENANT_ID,
            amount_kes=Decimal("1000"),
            source="MPESA",
            metadata={"external_ref": "TEST-REF-001"},
        )


if __name__ == "__main__":
    asyncio.run(main())