"""知识分类模型"""
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .user import gen_id
from ..core.database import Base


class Category(Base):
    """知识分类表"""
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String(64))
    icon: Mapped[str] = mapped_column(String(32), default="📚")  # emoji 或图标名
    # 是否免费：免费 + 已订阅 直接可用；付费则需要单独购买或开通 VIP
    is_free: Mapped[bool] = mapped_column(Boolean, default=True)
    # 单模块价格，单位：分（例如 390 = 3.9 元）；为 None 或 0 表示未设置单独价格
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    knowledge_points = relationship("KnowledgePoint", back_populates="category", cascade="all, delete-orphan")
    user_categories = relationship("UserCategory", back_populates="category")
    questions = relationship("Question", back_populates="category", cascade="all, delete-orphan")
