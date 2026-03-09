"""App 端 API（用户、推送、学习记录、付费、考试）"""
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..core.database import get_db
from ..models import (
    User,
    PushToken,
    UserCategory,
    Category,
    KnowledgePoint,
    LearnRecord,
    ExamRecord,
    ExamQuestion,
)
from ..schemas import (
    WechatLoginRequest,
    UserProfile,
    PushTokenRegister,
    LearnRecordCreate,
    PurchaseCategoryRequest,
    PurchaseVipRequest,
)

router = APIRouter(prefix="/app", tags=["App"])


@router.post("/wechat-login", response_model=UserProfile)
async def wechat_login(data: WechatLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    微信登录（当前为模拟实现）

    - 实际接入时应使用 code 到微信服务器换取 openid/unionid
    - 这里使用 code 计算一个伪 openid，方便本地联调
    """
    pseudo_openid = f"mock_{abs(hash(data.code)) % (10**10)}"

    result = await db.execute(select(User).where(User.wechat_openid == pseudo_openid))
    user = result.scalar_one_or_none()
    if not user:
        # 使用占位邮箱，后续可替换为微信昵称等信息
        user = User(phone_or_email=f"{pseudo_openid}@wechat.local", wechat_openid=pseudo_openid)
        db.add(user)
        await db.flush()

    return UserProfile(user_id=user.id, is_vip=user.is_vip, has_onboarded=user.has_onboarded)


@router.post("/push-token")
async def register_push_token(
    data: PushTokenRegister,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """注册推送 Token"""
    result = await db.execute(select(PushToken).where(PushToken.token == data.token))
    existing = result.scalar_one_or_none()
    if existing:
        existing.user_id = user_id
        existing.platform = data.platform
        return {"ok": True}
    token = PushToken(user_id=user_id, token=data.token, platform=data.platform)
    db.add(token)
    return {"ok": True}


@router.get("/categories")
async def list_categories_for_user(db: AsyncSession = Depends(get_db)):
    """获取所有可订阅的分类（供用户选择）"""
    result = await db.execute(select(Category).order_by(Category.sort_order))
    return [
        {
            "id": c.id,
            "name": c.name,
            "icon": c.icon,
            "is_free": c.is_free,
            "price": c.price,
        }
        for c in result.scalars().all()
    ]


@router.post("/subscribe")
async def subscribe_category(
    user_id: str = Query(...),
    category_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """订阅分类"""
    # 校验分类存在
    result = await db.execute(select(Category).where(Category.id == category_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "分类不存在")
    # 检查是否已订阅
    result = await db.execute(
        select(UserCategory).where(UserCategory.user_id == user_id, UserCategory.category_id == category_id)
    )
    if result.scalar_one_or_none():
        return {"ok": True, "message": "已订阅"}
    uc = UserCategory(user_id=user_id, category_id=category_id)
    db.add(uc)
    return {"ok": True}


@router.post("/onboard-done")
async def onboard_done(user_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """完成首次引导（选择知识类型后调用）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    user.has_onboarded = True
    return {"ok": True}


@router.post("/purchase/category")
async def purchase_category(
    payload: PurchaseCategoryRequest,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """模拟购买单个分类（后续接入微信支付）"""
    # 校验分类
    result = await db.execute(select(Category).where(Category.id == payload.category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(404, "分类不存在")

    # 写入订阅记录
    result = await db.execute(
        select(UserCategory).where(
            UserCategory.user_id == user_id,
            UserCategory.category_id == payload.category_id,
        )
    )
    if not result.scalar_one_or_none():
        uc = UserCategory(user_id=user_id, category_id=payload.category_id)
        db.add(uc)
    return {"ok": True}


@router.post("/purchase/vip")
async def purchase_vip(
    payload: PurchaseVipRequest,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """模拟开通包月 VIP（直接设置到期时间）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")

    months = max(payload.months, 1)
    base = user.vip_expire_at.date() if user.vip_expire_at and user.vip_expire_at > datetime.utcnow() else date.today()
    expire = base + timedelta(days=30 * months)
    user.is_vip = True
    user.vip_expire_at = datetime.combine(expire, datetime.min.time())
    return {"ok": True, "vip_expire_at": user.vip_expire_at}


@router.get("/categories-with-progress")
async def categories_with_progress(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取所有分类 + 当前用户的开通状态 & 学习进度"""
    # 用户信息
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")

    # 所有分类
    result = await db.execute(select(Category).order_by(Category.sort_order))
    categories = result.scalars().all()

    # 用户已订阅/购买的分类
    result = await db.execute(
        select(UserCategory.category_id).where(UserCategory.user_id == user_id)
    )
    subscribed_ids = {row[0] for row in result.all()}

    # 各分类总知识点
    result = await db.execute(
        select(KnowledgePoint.category_id, func.count(KnowledgePoint.id))
        .group_by(KnowledgePoint.category_id)
    )
    total_map: dict[str, int] = {cid: cnt for cid, cnt in result.all()}

    # 用户各分类已学习数（只统计 get）
    result = await db.execute(
        select(KnowledgePoint.category_id, func.count(LearnRecord.id))
        .join(LearnRecord, LearnRecord.knowledge_point_id == KnowledgePoint.id)
        .where(LearnRecord.user_id == user_id, LearnRecord.action == "get")
        .group_by(KnowledgePoint.category_id)
    )
    learned_map: dict[str, int] = {cid: cnt for cid, cnt in result.all()}

    data: list[dict[str, Any]] = []
    for c in categories:
        total = total_map.get(c.id, 0)
        learned = learned_map.get(c.id, 0)
        is_unlocked = c.is_free or user.is_vip or c.id in subscribed_ids

        status = "not_started"
        if total > 0 and learned >= total:
            status = "finished"
        elif learned > 0:
            status = "in_progress"

        data.append(
            {
                "id": c.id,
                "name": c.name,
                "icon": c.icon,
                "is_free": c.is_free,
                "price": c.price,
                "is_unlocked": is_unlocked,
                "learned_count": learned,
                "total_count": total,
                "status": status,
            }
        )

    return data


@router.get("/category/{category_id}/points")
async def get_category_points(
    category_id: str,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """获取某分类下的知识点列表（含是否已学习），仅对已开通用户开放"""
    # 校验用户对该分类有权限
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")

    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "分类不存在")

    is_unlocked = cat.is_free or user.is_vip
    if not is_unlocked:
        result = await db.execute(
            select(UserCategory).where(UserCategory.user_id == user_id, UserCategory.category_id == category_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(403, "请先开通该分类")

    # 该分类下所有知识点
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.category_id == category_id).order_by(KnowledgePoint.push_date)
    )
    points = result.scalars().all()

    # 用户已学习的
    result = await db.execute(
        select(LearnRecord.knowledge_point_id).where(
            LearnRecord.user_id == user_id,
            LearnRecord.action == "get",
            LearnRecord.knowledge_point_id.in_([p.id for p in points]),
        )
    )
    learned_ids = {r[0] for r in result.all()}

    return [
        {
            "id": p.id,
            "title": p.title,
            "content": p.content,
            "push_date": str(p.push_date),
            "learned": p.id in learned_ids,
        }
        for p in points
    ]


@router.get("/today")
async def get_today_knowledge(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """获取用户今日应推送的知识点（按订阅分类）"""
    today = date.today()
    # 用户订阅的分类
    sub_result = await db.execute(
        select(UserCategory.category_id).where(UserCategory.user_id == user_id)
    )
    category_ids = [r[0] for r in sub_result.all()]
    if not category_ids:
        return {"points": []}
    # 今日各分类下的知识点
    result = await db.execute(
        select(KnowledgePoint)
        .where(
            KnowledgePoint.category_id.in_(category_ids),
            KnowledgePoint.push_date == today,
        )
        .order_by(KnowledgePoint.created_at)
    )
    points = result.scalars().all()
    return {
        "points": [
            {"id": p.id, "title": p.title, "content": p.content, "category_id": p.category_id}
            for p in points
        ]
    }


@router.post("/learn")
async def record_learn(
    data: LearnRecordCreate,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """记录学习（Get / 稍后了解）"""
    record = LearnRecord(
        user_id=user_id,
        knowledge_point_id=data.knowledge_point_id,
        action=data.action,
    )
    db.add(record)
    return {"ok": True}


@router.get("/profile", response_model=UserProfile)
async def get_profile(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户基础信息（供“个人信息”模块使用）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    return UserProfile(user_id=user.id, is_vip=user.is_vip, has_onboarded=user.has_onboarded)


@router.post("/exam/start")
async def start_exam(
    user_id: str = Query(...),
    size: int = 5,
    db: AsyncSession = Depends(get_db),
):
    """
    开始一次随机考试

    - 从用户已学习过的知识点中随机抽题
    - 当前题型简化为“看内容，判断是否记得”（前端自由发挥）
    """
    size = max(1, min(size, 20))

    # 找到用户学过的知识点
    result = await db.execute(
        select(KnowledgePoint)
        .join(LearnRecord, LearnRecord.knowledge_point_id == KnowledgePoint.id)
        .where(LearnRecord.user_id == user_id, LearnRecord.action == "get")
        .order_by(LearnRecord.learned_at.desc())
    )
    points = result.scalars().all()
    if not points:
        raise HTTPException(400, "暂无可出题的已学习知识点")

    # 简单随机抽题
    import random

    sampled = random.sample(points, k=min(size, len(points)))

    exam = ExamRecord(user_id=user_id, score=0, total=len(sampled))
    db.add(exam)
    await db.flush()

    questions: list[ExamQuestion] = []
    for p in sampled:
        q = ExamQuestion(exam_id=exam.id, knowledge_point_id=p.id)
        db.add(q)
        questions.append(q)
    await db.flush()

    return {
        "exam_id": exam.id,
        "questions": [
            {
                "question_id": q.id,
                "knowledge_point_id": q.knowledge_point_id,
                "title": p.title,
                "content": p.content,
            }
            for q, p in zip(questions, sampled)
        ],
    }


@router.post("/exam/submit")
async def submit_exam(
    body: dict,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """提交考试答案并计算得分（当前逻辑：全部算对，用于打通流程）"""
    exam_id = body.get("exam_id", "")
    answers = body.get("answers", [])
    result = await db.execute(select(ExamRecord).where(ExamRecord.id == exam_id, ExamRecord.user_id == user_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(404, "考试不存在")

    # 简化：目前不做真正判题，全部记为正确，方便先打通前后端流程
    score = exam.total
    exam.score = score

    # 更新问题记录
    answer_map = {item["question_id"]: item.get("user_answer", "") for item in answers}
    result = await db.execute(select(ExamQuestion).where(ExamQuestion.exam_id == exam_id))
    for q in result.scalars().all():
        ua = answer_map.get(q.id, "")
        q.user_answer = ua
        q.is_correct = True

    return {"score": score, "total": exam.total}


@router.get("/exam/records")
async def list_exam_records(
    user_id: str = Query(...),
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """获取用户最近考试记录"""
    result = await db.execute(
        select(ExamRecord)
        .where(ExamRecord.user_id == user_id)
        .order_by(ExamRecord.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "score": r.score,
            "total": r.total,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@router.get("/curve/{user_id}")
async def get_knowledge_curve(
    user_id: str,
    month: str | None = None,  # YYYY-MM
    db: AsyncSession = Depends(get_db),
):
    """获取用户知识曲线（按月统计学习数量）"""
    q = (
        select(
            func.date(LearnRecord.learned_at).label("day"),
            func.count(LearnRecord.id).label("count"),
        )
        .where(LearnRecord.user_id == user_id, LearnRecord.action == "get")
        .group_by(func.date(LearnRecord.learned_at))
    )
    if month:
        start = datetime.strptime(month + "-01", "%Y-%m-%d").date()
        end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        q = q.where(LearnRecord.learned_at >= start, LearnRecord.learned_at <= end)
    result = await db.execute(q)
    rows = result.all()
    return {"curve": [{"date": str(r.day), "count": r.count} for r in rows]}
