"""问题 API - 后台管理选择题"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from ..core.database import get_db
from ..models import Question, Category, KnowledgePoint
from ..schemas import QuestionCreate, QuestionUpdate, QuestionResponse

router = APIRouter(prefix="/questions", tags=["问题"])


@router.get("", response_model=list[QuestionResponse])
async def list_questions(
    category_id: str | None = Query(None),
    knowledge_point_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """获取问题列表"""
    q = select(Question)
    if category_id:
        q = q.where(Question.category_id == category_id)
    if knowledge_point_id:
        q = q.where(Question.knowledge_point_id == knowledge_point_id)
    q = q.order_by(Question.sort_order, Question.created_at)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=QuestionResponse)
async def create_question(data: QuestionCreate, db: AsyncSession = Depends(get_db)):
    """创建问题"""
    # 校验知识点和分类存在
    r = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == data.knowledge_point_id))
    if not r.scalar_one_or_none():
        raise HTTPException(404, "知识点不存在")
    r = await db.execute(select(Category).where(Category.id == data.category_id))
    if not r.scalar_one_or_none():
        raise HTTPException(404, "分类不存在")

    q = Question(
        knowledge_point_id=data.knowledge_point_id,
        category_id=data.category_id,
        title=data.title,
        options=json.dumps(data.options, ensure_ascii=False),
        correct_answer=data.correct_answer,
    )
    db.add(q)
    await db.flush()
    await db.refresh(q)
    return q


@router.post("/batch-delete")
async def batch_delete_questions(ids: list[str] = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    """批量删除问题"""
    if not ids:
        return {"ok": True, "deleted": 0}
    result = await db.execute(select(Question).where(Question.id.in_(ids)))
    for q in result.scalars().all():
        await db.delete(q)
    return {"ok": True, "deleted": len(ids)}


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: str, db: AsyncSession = Depends(get_db)):
    """获取问题详情"""
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "问题不存在")
    return q


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str, data: QuestionUpdate, db: AsyncSession = Depends(get_db)
):
    """更新问题"""
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "问题不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "options" and v is not None:
            setattr(q, k, json.dumps(v, ensure_ascii=False))
        else:
            setattr(q, k, v)
    return q


@router.delete("/{question_id}")
async def delete_question(question_id: str, db: AsyncSession = Depends(get_db)):
    """删除问题"""
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "问题不存在")
    await db.delete(q)
    return {"ok": True}


@router.post("/import")
async def import_questions(
    category_id: str = Query(...),
    file: UploadFile = ...,
    db: AsyncSession = Depends(get_db),
):
    """导入问题（JSON）"""
    content = await file.read()
    data = json.loads(content.decode("utf-8"))
    items = data if isinstance(data, list) else [data]

    r = await db.execute(select(Category).where(Category.id == category_id))
    if not r.scalar_one_or_none():
        raise HTTPException(404, "分类不存在")

    created = 0
    for item in items:
        if not isinstance(item, dict) or not item.get("title") or not item.get("options"):
            continue
        kp_id = item.get("knowledge_point_id")
        if not kp_id:
            continue
        r = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == kp_id))
        if not r.scalar_one_or_none():
            continue
        opts = item["options"] if isinstance(item["options"], list) else []
        correct = item.get("correct_answer", "A")
        q = Question(
            knowledge_point_id=kp_id,
            category_id=category_id,
            title=item["title"],
            options=json.dumps(opts, ensure_ascii=False),
            correct_answer=correct,
        )
        db.add(q)
        created += 1
    return {"ok": True, "created": created}


@router.get("/export/{category_id}")
async def export_questions(category_id: str, db: AsyncSession = Depends(get_db)):
    """导出问题为 JSON"""
    result = await db.execute(
        select(Question)
        .where(Question.category_id == category_id)
        .order_by(Question.sort_order)
    )
    questions = result.scalars().all()
    data = [
        {
            "id": q.id,
            "knowledge_point_id": q.knowledge_point_id,
            "category_id": q.category_id,
            "title": q.title,
            "options": json.loads(q.options) if q.options else [],
            "correct_answer": q.correct_answer,
        }
        for q in questions
    ]
    from fastapi.responses import JSONResponse
    return JSONResponse(content=data)
