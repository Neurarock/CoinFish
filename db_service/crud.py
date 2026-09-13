"""CRUD helpers for DB microservice entities."""
from __future__ import annotations

from typing import Any, Optional, TypeVar

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


def apply_update(row: Any, payload: BaseModel) -> Any:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    return row


def create_row(db: Session, model: type[ModelT], payload: BaseModel) -> ModelT:
    row = model(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_row(db: Session, model: type[ModelT], row_id: int) -> Optional[ModelT]:
    return db.get(model, row_id)


def list_rows(
    db: Session,
    model: type[ModelT],
    *,
    limit: int = 100,
    offset: int = 0,
) -> list[ModelT]:
    stmt = select(model).offset(offset).limit(limit)
    return list(db.scalars(stmt).all())


def update_row(db: Session, row: ModelT, payload: BaseModel) -> ModelT:
    apply_update(row, payload)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_row(db: Session, row: ModelT) -> None:
    db.delete(row)
    db.commit()
