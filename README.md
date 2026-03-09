# 拾刻 · 极简微学习 App

> 每天 1 分钟，无压积累，看到成长轨迹

## 产品概述

拾刻是一款极简主义微学习 App，通过每天定时推送一个知识点（知识/单词/花语等），让用户在碎片化时间内轻松完成学习，培养终身学习的微习惯。

### 核心功能

- **用户端**：通知权限 → 选择知识类型 → 每日推送 → Get!/稍后了解 → 知识曲线
- **管理端**：分类管理、知识点 CRUD、导入导出、配置用户可开启的类别

### 技术架构

```mermaid
flowchart TB
    subgraph Client["客户端"]
        App["📱 拾刻 App (Expo)"]
    end
    subgraph Admin["管理端"]
        WebAdmin["🖥️ Web 后台 (React)"]
    end
    subgraph Server["服务端"]
        API["FastAPI API"]
        DB[(SQLite)]
    end
    App --> API
    WebAdmin --> API
    API --> DB
```

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- 小 Linux 服务器（可选，用于生产部署）

### 1. 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

初始化种子数据（可选）：

```bash
python scripts/seed.py
```

### 2. 启动 Web 后台

```bash
cd admin
npm install
npm run dev
```

访问 http://localhost:5174 管理分类和知识点。

### 3. 启动移动端

```bash
cd mobile
npm install
npx expo start
```

使用 Expo Go 扫码预览，或 `npx expo run:android` 构建 APK。

## 目录结构

```
daydayup/
├── backend/          # Python FastAPI 后端
│   ├── app/
│   │   ├── api/       # 路由
│   │   ├── models/    # 数据模型
│   │   └── core/      # 配置
│   └── scripts/      # 脚本
├── admin/             # 前端管理后台 (React)
├── mobile/            # 移动端 (Expo)
└── docs/              # 架构文档
```

## API 文档

启动后端后访问：http://localhost:8000/docs

### 主要接口

| 接口 | 说明 |
|------|------|
| `POST /api/v1/app/guest` | 游客注册 |
| `GET /api/v1/app/categories` | 获取分类列表 |
| `POST /api/v1/app/subscribe` | 订阅分类 |
| `GET /api/v1/app/today` | 获取今日知识点 |
| `POST /api/v1/app/learn` | 记录学习 |
| `GET /api/v1/categories` | 管理端：分类 CRUD |
| `GET /api/v1/knowledge` | 管理端：知识点 CRUD、导入导出 |

## 部署到 Linux 服务器

### 后端

```bash
# 使用 systemd 或 supervisor 管理进程
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 数据库

开发环境默认使用 SQLite。生产环境可配置 PostgreSQL：

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/shike
```

### 推送

当前推送为占位实现。接入生产需：

1. 配置 Firebase Cloud Messaging (FCM)
2. 在 `app/services/scheduler.py` 中实现 `_send_daily_push` 的 FCM 调用
3. 配置定时任务（每天 8:00 推送）

## 商业化

- **免费分类**：用户可直接订阅
- **付费分类**：单模块付费 或 包月 ¥3.9 开通全部
- 支付接入：微信支付 / 支付宝（需自行实现）

## 许可证

MIT
