"""知识点模型"""
from datetime import date
from sqlalchemy import String, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .user import gen_id
from ..core.database import Base
from datetime import datetime


class KnowledgePoint(Base):
    """知识点表"""
    __tablename__ = "knowledge_points"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("categories.id"), index=True)
    title: Mapped[str] = mapped_column(String(256))
    content: Mapped[str] = mapped_column(Text)
    extra: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON 扩展字段
    push_date: Mapped[date] = mapped_column(Date, index=True)  # 计划推送日期
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    category = relationship("Category", back_populates="knowledge_points")
    learn_records = relationship("LearnRecord", back_populates="knowledge_point")
