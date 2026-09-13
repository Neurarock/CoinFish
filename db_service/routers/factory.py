"""Shared FastAPI CRUD router factory."""

from typing import Type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import crud
from ..database import get_db


def make_crud_router(
    *,
    prefix: str,
    tags: list[str],
    model: type,
    create_schema: Type[BaseModel],
    update_schema: Type[BaseModel],
    read_schema: Type[BaseModel],
    not_found: str = "Record not found",
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=tags)

    @router.get("", response_model=list[read_schema])
    def list_items(
        limit: int = Query(100, ge=1, le=500),
        offset: int = Query(0, ge=0),
        db: Session = Depends(get_db),
    ):
        return crud.list_rows(db, model, limit=limit, offset=offset)

    @router.post("", response_model=read_schema, status_code=status.HTTP_201_CREATED)
    def create_item(payload: create_schema, db: Session = Depends(get_db)):
        return crud.create_row(db, model, payload)

    @router.get("/{item_id}", response_model=read_schema)
    def get_item(item_id: int, db: Session = Depends(get_db)):
        row = crud.get_row(db, model, item_id)
        if not row:
            raise HTTPException(status_code=404, detail=not_found)
        return row

    @router.patch("/{item_id}", response_model=read_schema)
    def patch_item(item_id: int, payload: update_schema, db: Session = Depends(get_db)):
        row = crud.get_row(db, model, item_id)
        if not row:
            raise HTTPException(status_code=404, detail=not_found)
        return crud.update_row(db, row, payload)

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def remove_item(item_id: int, db: Session = Depends(get_db)):
        row = crud.get_row(db, model, item_id)
        if not row:
            raise HTTPException(status_code=404, detail=not_found)
        crud.delete_row(db, row)
        return None

    return router
