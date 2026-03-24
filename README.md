# AI Coach Platform

> AI-Powered Training Platform for Medical Representatives — BeiGene (百济神州)

AI Coach 是一个为医药代表 (MR) 设计的 AI 教练平台，通过模拟真实的 HCP（Healthcare Professional）互动场景，帮助 MR 提升沟通技巧和产品知识。

## Features

- **F2F HCP Engagement** — 与 AI 虚拟医生进行一对一角色扮演练习
- **Multi-dimensional Scoring** — 多维度评分：关键信息传递、异议处理、沟通技巧等
- **HCP Profile Management** — 可配置的虚拟医生角色（性格、专业、认知背景）
- **Scenario Management** — 灵活的训练场景配置与管理
- **Training Session Lifecycle** — 完整的训练流程：创建 → 进行中 → 完成 → 评分
- **Real-time Coaching** — 训练过程中的实时建议与反馈
- **i18n Support** — 中英文双语支持，可扩展至欧洲多语言

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| Frontend | React 18+, TypeScript (strict), Vite 6+, Tailwind CSS v4 |
| AI Adapters | Azure OpenAI, Anthropic Claude, OpenAI GPT-4, Mock (dev) |
| Database | PostgreSQL (prod), SQLite (dev) |
| Testing | pytest + pytest-asyncio, Playwright (E2E) |
| Infrastructure | Docker, Azure Container Apps, GitHub Actions CI/CD |

## Architecture

```
Frontend (React SPA)  ──REST/WebSocket──▶  Backend (FastAPI)
                                              │
                                    ┌─────────┴──────────┐
                                    │   Service Layer     │
                                    │   AI Adapters       │
                                    │   (Claude/Azure/    │
                                    │    GPT-4/Mock)      │
                                    └─────────┬──────────┘
                                              │
                                         PostgreSQL
```

## Quick Start

### Prerequisites

- Python 3.11+, Node.js 20+, Docker (optional)

### Local Development

```bash
# Clone
git clone https://github.com/huqianghui/AI-Coach-vibe-coding.git
cd AI-Coach-vibe-coding

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
python3 scripts/init_db.py
python3 scripts/seed_data.py
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm ci
npm run dev
# → http://localhost:5173
```

### Docker

```bash
docker-compose up
# Backend:  http://localhost:8000
# Frontend: http://localhost:5173
```

### Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin@aicoach.com | admin123 |
| MR | mr@aicoach.com | test123 |

## API Documentation

启动后端后访问: http://localhost:8000/docs (Swagger UI)

### Available Endpoints

| Module | Prefix | Description |
|--------|--------|-------------|
| Auth | `/api/v1/auth` | JWT 登录、用户信息、Token 刷新 |
| HCP Profiles | `/api/v1/hcp-profiles` | 虚拟医生配置 CRUD |
| Scenarios | `/api/v1/scenarios` | 训练场景管理 |
| Sessions | `/api/v1/sessions` | 训练会话生命周期 |
| Scoring | `/api/v1/scoring` | 多维度评分 |
| Config | `/api/v1/config` | 系统配置 |
| Azure Config | `/api/v1/azure-config` | Azure AI 服务配置 |

## Project Structure

```
AI-Coach-vibe-coding/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (7 modules)
│   │   ├── models/       # SQLAlchemy ORM (6 models)
│   │   ├── schemas/      # Pydantic v2 schemas
│   │   ├── services/     # Business logic + AI adapters
│   │   └── utils/        # Exceptions, pagination
│   ├── tests/            # 25 test files, 269 test cases
│   └── alembic/          # Database migrations
├── frontend/
│   ├── src/
│   │   ├── pages/        # Route-level pages
│   │   ├── components/   # 114 React components
│   │   ├── hooks/        # TanStack Query hooks
│   │   └── api/          # Typed axios client
│   └── e2e/              # 13 Playwright E2E tests
├── docs/                 # Requirements, specs, plans
├── wiki/                 # Auto-synced to GitHub Wiki
├── .github/workflows/    # CI/CD pipelines
└── CLAUDE.md             # Engineering handbook
```

## Development

### Pre-Commit Checklist

```bash
# Backend
cd backend
ruff check .          # Lint
ruff format --check . # Format
pytest -v             # Tests (269 cases)

# Frontend
cd frontend
npx tsc -b            # Type check
npm run build         # Build
```

### Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## CI/CD Pipeline

```
Push/PR → backend-test → frontend-test → e2e-test → deploy (main only)
                                                      ↓
                                              Azure Container Apps
```

- **Backend Tests**: Ruff lint + format + pytest
- **Frontend Tests**: TypeScript check + Vite build
- **E2E Tests**: Playwright (Chromium)
- **Deploy**: Azure Container Apps via ACR (main branch only)

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Engineering handbook — coding standards, gotchas |
| [Wiki](../../wiki) | Architecture, onboarding, roadmap |
| [Requirements](docs/requirements.md) | Business requirements |
| [Best Practices](docs/best-practices.md) | Engineering patterns |

## License

Private — BeiGene Internal Use
