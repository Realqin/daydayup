"""问题模型 - 选择题，关联知识点"""
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .user import gen_id
from ..core.database import Base


class Question(Base):
    """
    问题表
    - 选择题形式，options 存选项 JSON，correct_answer 存正确答案（如 "A" 或 "ABCD"）
    - 通过 knowledge_point_id 关联知识点
    """
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    knowledge_point_id: Mapped[str] = mapped_column(String(36), ForeignKey("knowledge_points.id"), index=True)
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("categories.id"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    options: Mapped[str] = mapped_column(Text)  # JSON: ["A. xxx", "B. xxx", ...]
    correct_answer: Mapped[str] = mapped_column(String(32))  # "A" | "ABCD" 等
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    knowledge_point = relationship("KnowledgePoint", back_populates="questions")
    category = relationship("Category", back_populates="questions")
    exam_questions = relationship("ExamQuestion", back_populates="question")
