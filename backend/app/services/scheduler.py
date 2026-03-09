"""定时推送调度"""
from datetime import date, datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import AsyncSessionLocal
from ..models import UserCategory, KnowledgePoint, PushToken


async def _send_daily_push():
    """每日定时推送任务"""
    today = date.today()
    async with AsyncSessionLocal() as db:
        # 获取今日有知识点的分类
        result = await db.execute(
            select(KnowledgePoint)
            .where(KnowledgePoint.push_date == today)
            .distinct(KnowledgePoint.category_id)
        )
        # 简化：获取所有今日知识点对应的分类
        cat_result = await db.execute(
            select(KnowledgePoint.category_id).where(KnowledgePoint.push_date == today).distinct()
        )
        category_ids = [r[0] for r in cat_result.all()]
        if not category_ids:
            return
        # 获取订阅了这些分类的用户
        sub_result = await db.execute(
            select(UserCategory.user_id).where(UserCategory.category_id.in_(category_ids)).distinct()
        )
        user_ids = [r[0] for r in sub_result.all()]
        # 获取用户的 push token
        for uid in user_ids:
            token_result = await db.execute(select(PushToken).where(PushToken.user_id == uid))
            tokens = token_result.scalars().all()
            for t in tokens:
                # TODO: 调用 FCM/APNs 发送推送
                # 当前为占位，实际需接入 firebase-admin 等
                pass


def init_scheduler():
    """初始化调度器"""
    scheduler = AsyncIOScheduler()
    # 每天 8:00 推送
    scheduler.add_job(_send_daily_push, "cron", hour=8, minute=0)
    scheduler.start()
    return scheduler
