"""用户 Schema"""
from pydantic import BaseModel


class UserCreate(BaseModel):
    phone_or_email: str


class WechatLoginRequest(BaseModel):
    """微信登录请求（当前先模拟，后续对接真实 code）"""

    code: str


class UserProfile(BaseModel):
    """App 端用户基本信息返回"""

    user_id: str
    is_vip: bool
    has_onboarded: bool


class PushTokenRegister(BaseModel):
    token: str
    platform: str  # ios | android


class LearnRecordCreate(BaseModel):
    knowledge_point_id: str
    action: str  # get | later


class PurchaseCategoryRequest(BaseModel):
    category_id: str


class PurchaseVipRequest(BaseModel):
    """开通 VIP（后续可扩展支付单号等）"""

    months: int = 1
