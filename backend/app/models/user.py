"""用户相关模型"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    phone_or_email: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    # 微信相关标识（预留真实接入）
    wechat_openid: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    wechat_unionid: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    vip_expire_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 是否完成首次进入引导
    has_onboarded: Mapped[bool] = mapped_column(Boolean, default=False)

    push_tokens = relationship("PushToken", back_populates="user", cascade="all, delete-orphan")
    user_categories = relationship("UserCategory", back_populates="user", cascade="all, delete-orphan")
    learn_records = relationship("LearnRecord", back_populates="user", cascade="all, delete-orphan")
    exam_records = relationship("ExamRecord", back_populates="user", cascade="all, delete-orphan")


class PushToken(Base):
    """推送设备 Token"""
    __tablename__ = "push_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(Text, unique=True)
    platform: Mapped[str] = mapped_column(String(16))  # ios | android
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="push_tokens")


class UserCategory(Base):
    """用户订阅的分类"""
    __tablename__ = "user_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("categories.id"), index=True)
    subscribed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="user_categories")
    category = relationship("Category", back_populates="user_categories")
