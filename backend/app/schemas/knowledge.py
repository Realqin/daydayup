"""知识点 Schema"""
from datetime import date
from pydantic import BaseModel


class KnowledgePointBase(BaseModel):
    category_id: str
    title: str
    content: str
    extra: str | None = None
    push_date: date


class KnowledgePointCreate(KnowledgePointBase):
    pass


class KnowledgePointUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    extra: str | None = None
    push_date: date | None = None


class KnowledgePointResponse(KnowledgePointBase):
    id: str

    class Config:
        from_attributes = True
