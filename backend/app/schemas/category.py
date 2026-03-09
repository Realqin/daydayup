"""分类 Schema"""
from pydantic import BaseModel


class CategoryBase(BaseModel):
    name: str
    icon: str = "📚"
    is_free: bool = True
    price: int | None = None  # 单位：分
    sort_order: int = 0


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    is_free: bool | None = None
    price: int | None = None
    sort_order: int | None = None


class CategoryResponse(CategoryBase):
    id: str

    class Config:
        from_attributes = True
