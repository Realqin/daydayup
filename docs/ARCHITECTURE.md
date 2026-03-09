# 拾刻 - 架构设计文档

## 1. 产品概述

**拾刻** 是一款极简主义微学习 App，通过每天定时推送一个知识点，让用户在碎片化时间内轻松完成学习，培养终身学习的微习惯。

## 2. 系统架构图

```mermaid
flowchart TB
    subgraph Client["客户端层"]
        App["📱 拾刻 App<br/>(React Native)"]
    end
    
    subgraph Admin["管理端"]
        WebAdmin["🖥️ Web 后台<br/>(React + Vite)"]
    end
    
    subgraph Server["服务端 (Linux)"]
        API["FastAPI<br/>REST API"]
        Scheduler["定时任务<br/>推送调度"]
        Push["推送服务<br/>FCM/APNs"]
    end
    
    subgraph Data["数据层"]
        DB[(SQLite/PostgreSQL)]
    end
    
    App -->|HTTPS| API
    WebAdmin -->|HTTPS| API
    API --> DB
    Scheduler --> API
    Scheduler --> Push
    Push -->|Push Notification| App
```

## 3. 核心数据模型

```mermaid
erDiagram
    User ||--o{ UserCategory : "订阅"
    User ||--o{ LearnRecord : "学习记录"
    User ||--o{ PushToken : "设备"
    
    Category ||--o{ KnowledgePoint : "包含"
    Category ||--o{ UserCategory : "被订阅"
    
    KnowledgePoint ||--o{ LearnRecord : "被学习"
    
    User {
        string id PK
        string phone_or_email
        datetime created_at
        bool is_vip
        datetime vip_expire_at
    }
    
    Category {
        string id PK
        string name
        string icon
        bool is_free
        int sort_order
    }
    
    KnowledgePoint {
        string id PK
        string category_id FK
        string title
        string content
        string extra
        date push_date
    }
    
    LearnRecord {
        string id PK
        string user_id FK
        string point_id FK
        datetime learned_at
        string action "get|later"
    }
    
    UserCategory {
        string user_id FK
        string category_id FK
        datetime subscribed_at
    }
    
    PushToken {
        string id PK
        string user_id FK
        string token
        string platform "ios|android"
    }
```

## 4. 交互流程图

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as App
    participant S as 服务端
    participant P as 推送服务
    
    U->>A: 下载安装
    A->>U: 请求通知权限
    U->>A: 授权
    A->>S: 注册 PushToken
    U->>A: 选择知识类型
    A->>S: 订阅分类
    
    loop 每日定时
        S->>P: 触发推送
        P->>A: 推送通知
        A->>U: 弹框展示知识点
        U->>A: 点击 Get! / 稍后了解
        A->>S: 上报学习记录
        alt 稍后了解
            S->>P: 1小时后再次推送
        end
    end
    
    Note over S,U: 每月生成习题，绘制知识曲线
```

## 5. 技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| 后端 API | FastAPI | 高性能、异步、自动文档 |
| 数据库 | SQLite (开发) / PostgreSQL (生产) | 轻量部署 |
| 定时任务 | APScheduler | 内置调度，无需额外组件 |
| 推送 | Firebase Cloud Messaging | 支持 Android/iOS |
| Web 后台 | React + Vite + Ant Design | 管理知识点 CRUD |
| 移动端 | React Native + Expo | 跨平台，JS 技术栈 |

## 6. 目录结构

```
daydayup/
├── backend/          # Python 后端
│   ├── app/
│   │   ├── api/      # 路由
│   │   ├── models/   # 数据模型
│   │   ├── services/ # 业务逻辑
│   │   └── core/     # 配置
│   └── requirements.txt
├── admin/            # Web 后台
│   └── src/
├── mobile/           # 移动端 App
│   └── app/
├── docs/             # 文档
└── README.md
```

## 7. 商业化逻辑

```mermaid
flowchart LR
    A[用户选择分类] --> B{分类类型?}
    B -->|免费| C[直接订阅]
    B -->|付费| D{用户是否 VIP?}
    D -->|是| C
    D -->|否| E[单模块付费 或 包月 3.9元]
    E --> F[支付]
    F --> C
```
