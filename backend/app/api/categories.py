"""分类 API"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.database import get_db
from ..models import Category
from ..schemas import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["分类"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    """获取所有分类"""
    result = await db.execute(select(Category).order_by(Category.sort_order, Category.created_at))
    return result.scalars().all()


@router.post("", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    """创建分类"""
    category = Category(**data.model_dump())
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.post("/batch-delete")
async def batch_delete_categories(ids: list[str] = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    """批量删除分类"""
    if not ids:
        return {"ok": True, "deleted": 0}
    result = await db.execute(select(Category).where(Category.id.in_(ids)))
    for c in result.scalars().all():
        await db.delete(c)
    return {"ok": True, "deleted": len(ids)}


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: str, db: AsyncSession = Depends(get_db)):
    """获取分类详情"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(404, "分类不存在")
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    """更新分类"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(404, "分类不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(category, k, v)
    # 不调用 refresh：refresh 会从 DB 重新加载并覆盖内存中的修改，导致更新丢失
    return category


@router.delete("/{category_id}")
async def delete_category(category_id: str, db: AsyncSession = Depends(get_db)):
    """删除分类"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(404, "分类不存在")
    await db.delete(category)
    return {"ok": True}
