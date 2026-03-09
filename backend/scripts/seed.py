"""初始化种子数据"""
import asyncio
from datetime import date, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import AsyncSessionLocal, init_db
from app.models import Category, KnowledgePoint


async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        # 检查是否已有数据
        from sqlalchemy import select
        r = await db.execute(select(Category).limit(1))
        if r.scalar_one_or_none():
            print("已有数据，跳过 seed")
            return

        # 创建分类（含一个付费示例）
        cats = [
            Category(name="每日一词", icon="📖", is_free=True, sort_order=0),
            Category(name="小知识", icon="💡", is_free=True, sort_order=1),
            Category(name="花语", icon="🌸", is_free=True, sort_order=2),
            Category(name="专业词汇", icon="📚", is_free=False, price=390, sort_order=3),  # 3.9元
        ]
        for c in cats:
            db.add(c)
        await db.flush()

        # 为每个分类添加示例知识点
        today = date.today()
        samples = [
            ("abandon", "v. 放弃；遗弃\n\n例：He abandoned his wife and children. 他抛弃了妻子和孩子。"),
            ("光合作用", "植物利用光能将二氧化碳和水转化为葡萄糖的过程。叶绿体是进行光合作用的场所。"),
            ("玫瑰", "象征爱情与美好。红玫瑰代表热情的爱，白玫瑰象征纯洁。"),
        ]
        samples.append(("jargon", "n. 行话；术语\n\n例：Avoid jargon in your writing. 写作中避免使用行话。"))
        for i, (title, content) in enumerate(samples):
            cat = cats[i % len(cats)]
            for j in range(7):
                d = today + timedelta(days=j)
                p = KnowledgePoint(
                    category_id=cat.id,
                    title=title,
                    content=content,
                    push_date=d,
                )
                db.add(p)

        await db.commit()
        print("Seed 完成：4 个分类，28 个知识点")


if __name__ == "__main__":
    asyncio.run(seed())
