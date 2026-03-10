"""考试相关模型"""
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .user import gen_id
from ..core.database import Base


class ExamRecord(Base):
    """一次考试记录（整体得分）"""

    __tablename__ = "exam_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="exam_records")
    questions = relationship("ExamQuestion", back_populates="exam", cascade="all, delete-orphan")


class ExamQuestion(Base):
    """考试中的具体题目 - 用户-问题-答题结果"""

    __tablename__ = "exam_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    exam_id: Mapped[str] = mapped_column(String(36), ForeignKey("exam_records.id"), index=True)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), index=True)
    user_answer: Mapped[str | None] = mapped_column(String(64), nullable=True)  # "A" | "ABCD" 等
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    exam = relationship("ExamRecord", back_populates="questions")
    question = relationship("Question", back_populates="exam_questions")

