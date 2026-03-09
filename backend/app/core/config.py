"""应用配置"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """配置项"""
    # 数据库
    database_url: str = "sqlite+aiosqlite:///./shike.db"
    
    # API
    api_prefix: str = "/api/v1"
    
    # 推送（后续接入 FCM）
    fcm_server_key: str = ""
    
    class Config:
        env_file = ".env"


settings = Settings()
