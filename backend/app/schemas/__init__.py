"""Pydantic  schemas"""
from .category import CategoryCreate, CategoryUpdate, CategoryResponse
from .knowledge import KnowledgePointCreate, KnowledgePointUpdate, KnowledgePointResponse
from .question import QuestionCreate, QuestionUpdate, QuestionResponse
from .user import (
    UserCreate,
    WechatLoginRequest,
    UserProfile,
    PushTokenRegister,
    LearnRecordCreate,
    PurchaseCategoryRequest,
    PurchaseVipRequest,
)

__all__ = [
    "QuestionCreate",
    "QuestionUpdate",
    "QuestionResponse",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryResponse",
    "KnowledgePointCreate",
    "KnowledgePointUpdate",
    "KnowledgePointResponse",
    "UserCreate",
    "WechatLoginRequest",
    "UserProfile",
    "PushTokenRegister",
    "LearnRecordCreate",
    "PurchaseCategoryRequest",
    "PurchaseVipRequest",
]
