# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Training  │ │ Scenario │ │ Scoring  │ │   Dashboard    │  │
│  │ Session   │ │ Config   │ │ & Report │ │   & Analytics  │  │
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └───────┬────────┘  │
│        └─────────────┴───────────┴───────────────┘           │
│                         API Layer (axios)                      │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────┴───────────────────────────────────┐
│                      Backend (FastAPI)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Auth     │ │ Session  │ │ Scoring  │ │  HCP Profile   │  │
│  │ Router   │ │ Router   │ │ Router   │ │  Router        │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       └─────────────┴────────────┴───────────────┘           │
│                      Service Layer                            │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              AI Coaching Adapters                      │    │
│  │  ┌─────────┐ ┌──────────┐ ┌──────┐ ┌──────────────┐ │    │
│  │  │ Claude  │ │ Azure    │ │ GPT-4│ │ Mock (dev)   │ │    │
│  │  │ Adapter │ │ OpenAI   │ │      │ │              │ │    │
│  │  └─────────┘ └──────────┘ └──────┘ └──────────────┘ │    │
│  └──────────────────────────────────────────────────────┘    │
│                      Database Layer (SQLAlchemy)               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │  PostgreSQL  │
                    │  (SQLite dev)│
                    └─────────────┘
```

## Backend Architecture

### Layered Pattern
```
Router (HTTP) → Schema (Validation) → Service (Business Logic) → Model (ORM) → Database
```

### Key Domain Models
- **User**: MR accounts with role/BU association
- **HCPProfile**: Virtual doctor configuration (personality, knowledge, perspective)
- **Scenario**: Training scenario definitions
- **Session**: Training session lifecycle management
- **Conversation**: Chat history within sessions
- **Assessment**: Multi-dimensional scoring results
- **TrainingMaterial**: Document/content management
- **Report**: Generated training reports

### AI Adapter Architecture
```
BaseCoachingAdapter (ABC)
├── execute() → AsyncIterator[CoachEvent]
├── is_available() → bool
├── get_version() → str | None
│
├── ClaudeAdapter (Anthropic Claude)
├── AzureOpenAIAdapter (Azure OpenAI)
├── GPT4Adapter (OpenAI native)
└── MockAdapter (dev/test)
```

## Frontend Architecture

### Component Hierarchy
```
App
├── AuthProvider
│   ├── LoginPage
│   └── Layout
│       ├── Sidebar (navigation)
│       ├── PageHeader
│       └── Routes
│           ├── DashboardPage
│           ├── TrainingSessionPage
│           │   ├── ScenarioSelector
│           │   ├── ChatInterface (audio/text)
│           │   └── ScoringPanel
│           ├── ScenarioConfigPage
│           ├── HCPProfilePage
│           ├── ReportPage
│           └── AdminPages
└── CoachChatPanel (sidebar agent)
```

### State Management
- **Server state**: TanStack Query (sessions, scenarios, reports)
- **Auth state**: Lightweight store (JWT, user info)
- **UI state**: React local state + Context for agent routing

## Data Flow

### Training Session Flow
```
1. MR selects scenario + HCP profile
2. Session created (status: created → in_progress)
3. MR interacts via audio/text
4. AI adapter processes input → generates HCP response
5. Real-time scoring suggestions shown
6. Session ends → comprehensive scoring generated
7. Report persisted → dashboard updated
```

### Deployment
```
GitHub → CI/CD → Azure Container Registry → Azure Container Apps
                  ├── ai-coach-backend (FastAPI + uvicorn)
                  └── ai-coach-frontend (nginx + React SPA)
```
