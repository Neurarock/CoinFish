from fastapi import APIRouter

from .. import models, schemas
from .factory import make_crud_router

router = APIRouter()
router.include_router(
    make_crud_router(
        prefix="/lenders",
        tags=["lenders"],
        model=models.Lender,
        create_schema=schemas.LenderCreate,
        update_schema=schemas.LenderUpdate,
        read_schema=schemas.LenderRead,
        not_found="Lender not found",
    )
)
router.include_router(
    make_crud_router(
        prefix="/borrowers",
        tags=["borrowers"],
        model=models.Borrower,
        create_schema=schemas.BorrowerCreate,
        update_schema=schemas.BorrowerUpdate,
        read_schema=schemas.BorrowerRead,
        not_found="Borrower not found",
    )
)
router.include_router(
    make_crud_router(
        prefix="/pools",
        tags=["pools"],
        model=models.Pool,
        create_schema=schemas.PoolCreate,
        update_schema=schemas.PoolUpdate,
        read_schema=schemas.PoolRead,
        not_found="Pool not found",
    )
)
router.include_router(
    make_crud_router(
        prefix="/partners",
        tags=["partners"],
        model=models.Partner,
        create_schema=schemas.PartnerCreate,
        update_schema=schemas.PartnerUpdate,
        read_schema=schemas.PartnerRead,
        not_found="Partner not found",
    )
)
router.include_router(
    make_crud_router(
        prefix="/transactions",
        tags=["transactions"],
        model=models.Transaction,
        create_schema=schemas.TransactionCreate,
        update_schema=schemas.TransactionUpdate,
        read_schema=schemas.TransactionRead,
        not_found="Transaction not found",
    )
)
