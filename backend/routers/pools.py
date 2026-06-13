"""Pool metrics shared by the lender deposit screen and the admin dashboard."""
from __future__ import annotations

from fastapi import APIRouter

from .. import config
from ..runtime import rt
from ..schemas import PoolOut

router = APIRouter(prefix="/pools", tags=["pools"])


def pool_out(key: str) -> PoolOut:
    p = rt.pools[key]
    net_apr = round(p.base_apr * (1 - config.MANAGEMENT_FEE), 4)
    return PoolOut(
        key=p.key,
        name=p.name,
        risk_tier=p.risk_tier,
        base_apr=p.base_apr,
        net_apr=net_apr,
        first_loss_buffer=p.cover_rate_minimum,
        tvl=round(p.tvl, 2),
        available=round(p.available, 2),
        drawn=round(p.drawn, 2),
        utilisation=round(p.utilisation, 4),
        first_loss_capital=round(p.first_loss_capital, 2),
    )


@router.get("", response_model=list[PoolOut])
def list_pools() -> list[PoolOut]:
    return [pool_out(k) for k in rt.pools]


@router.get("/{key}", response_model=PoolOut)
def get_pool(key: str) -> PoolOut:
    return pool_out(key)
