# tests/test_tier_staff_limits.py
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.tenant import Tenant
from app.models.user import User
from app.models.tenant_membership import TenantMembership
from app.models.tenant_invitation import TenantInvitation


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def create_tenant(db, tier: str) -> Tenant:
    tenant = Tenant(
        name=f"Test Tenant {uuid.uuid4().hex[:8]}",
        tier=tier,
        is_active=True,
    )
    db.add(tenant)
    await db.flush()
    return tenant


async def create_user(db, email: str) -> User:
    user = User(email=email.lower().strip(), is_active=True)
    db.add(user)
    await db.flush()
    return user


async def add_membership(
    db,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    is_active: bool = True,
):
    m = TenantMembership(
        tenant_id=tenant_id,
        user_id=user_id,
        role=role,
        permissions=[],
        accepted_terms=True,
        notifications_opt_in=False,
        is_active=is_active,
        referral_code=None,
    )
    db.add(m)
    await db.flush()
    return m


async def create_invite(db, tenant_id: uuid.UUID, email: str, role: str = "STAFF") -> TenantInvitation:
    inv = TenantInvitation(
        tenant_id=tenant_id,
        email=email.lower().strip(),
        role=role,
        permissions=[],
        token=f"tok_{uuid.uuid4().hex}",
        expires_at=utcnow() + timedelta(days=7),
        accepted_at=None,
        accepted_by_user_id=None,
    )
    db.add(inv)
    await db.flush()
    return inv


@pytest.mark.asyncio
async def test_sungura_blocks_second_staff(client, db):
    tenant = await create_tenant(db, tier="sungura")

    # existing active STAFF = 1 (limit is 1)
    u1 = await create_user(db, "staff1@example.com")
    await add_membership(db, tenant.id, u1.id, role="STAFF", is_active=True)

    inv = await create_invite(db, tenant.id, "staff2@example.com", role="STAFF")
    await db.commit()

    r = await client.post(
        "/api/v1/tenant-invitations/accept",
        json={"token": inv.token, "accept_tos": True, "accept_notifications": False},
    )

    assert r.status_code == 403
    body = r.json()
    assert body["detail"]["error"] == "STAFF_LIMIT_EXCEEDED"
    assert body["detail"]["limit"] == 1
    assert body["detail"]["active_staff"] == 1


@pytest.mark.asyncio
async def test_swara_blocks_sixth_staff(client, db):
    tenant = await create_tenant(db, tier="swara")

    # existing active STAFF = 5 (limit is 5)
    for i in range(5):
        u = await create_user(db, f"staff{i}@example.com")
        await add_membership(db, tenant.id, u.id, role="STAFF", is_active=True)

    inv = await create_invite(db, tenant.id, "staff5@example.com", role="STAFF")
    await db.commit()

    r = await client.post(
        "/api/v1/tenant-invitations/accept",
        json={"token": inv.token, "accept_tos": True, "accept_notifications": False},
    )

    assert r.status_code == 403
    body = r.json()
    assert body["detail"]["error"] == "STAFF_LIMIT_EXCEEDED"
    assert body["detail"]["limit"] == 5
    assert body["detail"]["active_staff"] == 5


@pytest.mark.asyncio
async def test_ndovu_blocks_eleventh_staff(client, db):
    tenant = await create_tenant(db, tier="ndovu")

    # existing active STAFF = 10 (limit is 10)
    for i in range(10):
        u = await create_user(db, f"staff{i}@example.com")
        await add_membership(db, tenant.id, u.id, role="STAFF", is_active=True)

    inv = await create_invite(db, tenant.id, "staff10@example.com", role="STAFF")
    await db.commit()

    r = await client.post(
        "/api/v1/tenant-invitations/accept",
        json={"token": inv.token, "accept_tos": True, "accept_notifications": False},
    )

    assert r.status_code == 403
    body = r.json()
    assert body["detail"]["error"] == "STAFF_LIMIT_EXCEEDED"
    assert body["detail"]["limit"] == 10
    assert body["detail"]["active_staff"] == 10


@pytest.mark.asyncio
async def test_admin_invite_not_blocked_even_when_staff_full(client, db):
    tenant = await create_tenant(db, tier="sungura")

    # staff full
    u1 = await create_user(db, "staff1@example.com")
    await add_membership(db, tenant.id, u1.id, role="STAFF", is_active=True)

    inv = await create_invite(db, tenant.id, "admin1@example.com", role="ADMIN")
    await db.commit()

    r = await client.post(
        "/api/v1/tenant-invitations/accept",
        json={"token": inv.token, "accept_tos": True, "accept_notifications": False},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["tenant_id"] == str(tenant.id)
    assert body["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_inactive_staff_does_not_count(client, db):
    tenant = await create_tenant(db, tier="sungura")

    u1 = await create_user(db, "staff1@example.com")
    await add_membership(db, tenant.id, u1.id, role="STAFF", is_active=False)  # inactive should not count

    inv = await create_invite(db, tenant.id, "staff2@example.com", role="STAFF")
    await db.commit()

    r = await client.post(
        "/api/v1/tenant-invitations/accept",
        json={"token": inv.token, "accept_tos": True, "accept_notifications": False},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["role"] == "STAFF"


@pytest.mark.asyncio
async def test_reaccept_does_not_block_if_user_already_active_staff(client, db):
    tenant = await create_tenant(db, tier="sungura")

    # staff full, but invited user is the same active staff (exclude self should prevent block)
    u1 = await create_user(db, "same@example.com")
    await add_membership(db, tenant.id, u1.id, role="STAFF", is_active=True)

    inv = await create_invite(db, tenant.id, "same@example.com", role="STAFF")
    await db.commit()

    r = await client.post(
        "/api/v1/tenant-invitations/accept",
        json={"token": inv.token, "accept_tos": True, "accept_notifications": False},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["role"] == "STAFF"


# ==========================================================
# NEW TEST (added): ADMIN accept should bypass staff limit
# ==========================================================
@pytest.mark.asyncio
async def test_admin_accept_not_blocked_when_staff_full(client, db):
    tenant = await create_tenant(db, tier="sungura")

    # Fill staff slots (sungura limit assumed = 1)
    u1 = await create_user(db, "staff1@example.com")
    await add_membership(db, tenant.id, u1.id, role="STAFF", is_active=True)

    # Create ADMIN invitation
    inv = await create_invite(db, tenant.id, email="admin2@example.com", role="ADMIN")
    await db.commit()

    # Accept should succeed (ADMIN bypasses staff limit)
    r = await client.post(
        "/api/v1/tenant-invitations/accept",
        json={
            "token": inv.token,
            "accept_tos": True,
            "accept_notifications": False,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["tenant_id"] == str(tenant.id)
    assert body["role"] == "ADMIN"
