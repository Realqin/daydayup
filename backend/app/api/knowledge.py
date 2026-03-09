"""知识点 API"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io
import json

from ..core.database import get_db
from ..models import KnowledgePoint, Category
from ..schemas import KnowledgePointCreate, KnowledgePointUpdate, KnowledgePointResponse

router = APIRouter(prefix="/knowledge", tags=["知识点"])


@router.get("", response_model=list[KnowledgePointResponse])
async def list_knowledge(
    category_id: str | None = Query(None),
    push_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """获取知识点列表，支持按分类、日期筛选"""
    q = select(KnowledgePoint)
    if category_id:
        q = q.where(KnowledgePoint.category_id == category_id)
    if push_date:
        q = q.where(KnowledgePoint.push_date == push_date)
    q = q.order_by(KnowledgePoint.push_date.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=KnowledgePointResponse)
async def create_knowledge(data: KnowledgePointCreate, db: AsyncSession = Depends(get_db)):
    """创建知识点"""
    point = KnowledgePoint(**data.model_dump())
    db.add(point)
    await db.flush()
    await db.refresh(point)
    return point


@router.get("/{point_id}", response_model=KnowledgePointResponse)
async def get_knowledge(point_id: str, db: AsyncSession = Depends(get_db)):
    """获取知识点详情"""
    result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == point_id))
    point = result.scalar_one_or_none()
    if not point:
        raise HTTPException(404, "知识点不存在")
    return point


@router.put("/{point_id}", response_model=KnowledgePointResponse)
async def update_knowledge(point_id: str, data: KnowledgePointUpdate, db: AsyncSession = Depends(get_db)):
    """更新知识点"""
    result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == point_id))
    point = result.scalar_one_or_none()
    if not point:
        raise HTTPException(404, "知识点不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(point, k, v)
    await db.refresh(point)
    return point


@router.delete("/{point_id}")
async def delete_knowledge(point_id: str, db: AsyncSession = Depends(get_db)):
    """删除知识点"""
    result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == point_id))
    point = result.scalar_one_or_none()
    if not point:
        raise HTTPException(404, "知识点不存在")
    await db.delete(point)
    return {"ok": True}


@router.post("/import")
async def import_knowledge(
    category_id: str = Query(...),
    file: UploadFile = ...,
    db: AsyncSession = Depends(get_db),
):
    """导入知识点（JSON 或 Excel）"""
    content = await file.read()
    filename = file.filename or ""

    if filename.endswith(".json"):
        data = json.loads(content.decode("utf-8"))
        items = data if isinstance(data, list) else [data]
    else:
        # Excel 导入
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
        ws = wb.active
        items = []
        headers = None
        for row in ws.iter_rows(values_only=True):
            if headers is None:
                headers = [str(h).lower() if h else f"col{i}" for i, h in enumerate(row)]
                continue
            row_dict = dict(zip(headers, row))
            if row_dict.get("title") and row_dict.get("content"):
                items.append({
                    "title": str(row_dict["title"]),
                    "content": str(row_dict["content"]),
                    "push_date": str(row_dict.get("push_date", "")),
                })

    # 验证分类存在
    result = await db.execute(select(Category).where(Category.id == category_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "分类不存在")

    from datetime import datetime
    created = 0
    for item in items:
        if isinstance(item, dict):
            push_date_str = item.get("push_date") or ""
            try:
                push_date = datetime.strptime(push_date_str[:10], "%Y-%m-%d").date() if push_date_str else date.today()
            except ValueError:
                push_date = date.today()
            point = KnowledgePoint(
                category_id=category_id,
                title=item.get("title", ""),
                content=item.get("content", ""),
                extra=json.dumps(item.get("extra", {})) if item.get("extra") else None,
                push_date=push_date,
            )
            db.add(point)
            created += 1

    return {"ok": True, "created": created}


@router.get("/export/{category_id}")
async def export_knowledge(category_id: str, db: AsyncSession = Depends(get_db)):
    """导出知识点为 JSON"""
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.category_id == category_id).order_by(KnowledgePoint.push_date)
    )
    points = result.scalars().all()
    data = [
        {
            "id": p.id,
            "title": p.title,
            "content": p.content,
            "push_date": str(p.push_date),
            "extra": p.extra,
        }
        for p in points
    ]
    from fastapi.responses import JSONResponse
    return JSONResponse(content=data)
