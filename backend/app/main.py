"""拾刻 - 主入口"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import init_db
from .api import categories, knowledge, app_api


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    await init_db()
    yield
    # 关闭时清理


app = FastAPI(
    title="拾刻 API",
    description="极简主义微学习 App 后端",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router, prefix=settings.api_prefix)
app.include_router(knowledge.router, prefix=settings.api_prefix)
app.include_router(app_api.router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {"app": "拾刻", "version": "0.1.0"}
