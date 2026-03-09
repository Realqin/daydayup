"""学习记录模型"""
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .user import gen_id
from ..core.database import Base
from datetime import datetime


class LearnRecord(Base):
    """学习记录表"""
    __tablename__ = "learn_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    knowledge_point_id: Mapped[str] = mapped_column(String(36), ForeignKey("knowledge_points.id"), index=True)
    learned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    action: Mapped[str] = mapped_column(String(16))  # get | later

    user = relationship("User", back_populates="learn_records")
    knowledge_point = relationship("KnowledgePoint", back_populates="learn_records")
