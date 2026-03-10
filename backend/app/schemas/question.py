"""问题 Schema"""
import json
from pydantic import BaseModel, field_validator


class QuestionBase(BaseModel):
    knowledge_point_id: str
    category_id: str
    title: str
    options: list[str]  # ["A. xxx", "B. xxx", ...]
    correct_answer: str  # "A" | "ABCD"


class QuestionCreate(QuestionBase):
    @field_validator("options", mode="before")
    @classmethod
    def options_to_list(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else []
        return v


class QuestionUpdate(BaseModel):
    title: str | None = None
    options: list[str] | None = None
    correct_answer: str | None = None


class QuestionResponse(QuestionBase):
    id: str

    @field_validator("options", mode="before")
    @classmethod
    def options_from_db(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else []
        return v or []

    class Config:
        from_attributes = True
