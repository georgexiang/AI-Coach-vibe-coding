# Phase 07: Azure Service Integration - Research

**Researched:** 2026-03-27
**Domain:** Azure service configuration persistence, dynamic adapter switching, Fernet encryption, Azure OpenAI streaming
**Confidence:** HIGH

## Summary

Phase 07 bridges the existing disconnected Azure Config UI with real backend persistence and live Azure service connectivity. The frontend pages (`azure-config.tsx`, `service-config-card.tsx`) and backend read API (`azure_config.py`) already exist but are incomplete -- `onSave` only updates React state, `onTestConnection` uses `Math.random()`, and there is no PUT endpoint to persist configurations. The backend already has a complete adapter framework (`BaseCoachingAdapter`, `ServiceRegistry`, `MockCoachingAdapter`), Azure STT/TTS adapters from Phase 06, and the `openai` SDK (v1.51.0) with `AsyncAzureOpenAI` client support. The `cryptography` package (v46.0.5) with Fernet is already installed as a transitive dependency of `python-jose[cryptography]`.

The core work is: (1) a new `ServiceConfig` database model with Fernet-encrypted API keys, (2) CRUD API endpoints with real connection testing, (3) an `AzureOpenAIAdapter` implementing `BaseCoachingAdapter` with async streaming, (4) runtime adapter re-registration on config save, and (5) frontend wiring to call the new backend endpoints instead of local state.

**Primary recommendation:** Implement a `service_config` database table with Fernet encryption for API keys, a config service for CRUD + connection testing, the `AzureOpenAIAdapter` using `AsyncAzureOpenAI` with streaming, and wire the frontend to the real API -- following the exact adapter patterns already established by `MockCoachingAdapter` and the Phase 06 Azure STT/TTS adapters.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Store Azure service configs in a new `service_config` database table (not `.env` files)
- Config model: service_name, endpoint, api_key (encrypted), model/deployment, region, is_active, updated_by
- API keys must be encrypted at rest using Fernet symmetric encryption
- On server startup, load active configs from DB and register corresponding adapters
- `PUT /api/v1/azure-config/services/{service_name}` -- Create/update service configuration
- `POST /api/v1/azure-config/services/{service_name}/test` -- Real connection test
- `GET /api/v1/azure-config/services` -- Already exists, enhance to read from DB
- All endpoints require admin role
- Implement `AzureOpenAIAdapter` extending `BaseCoachingAdapter`
- Use `openai` SDK with Azure configuration (already a dependency)
- Support streaming responses via SSE (matching existing mock adapter pattern)
- Register under category "llm" with name "azure_openai"
- Implement `AzureSpeechSTTAdapter` and `AzureSpeechTTSAdapter` -- these ALREADY EXIST from Phase 06
- Register under categories "stt" and "tts" -- already done in main.py lifespan
- On config save: re-register the adapter in ServiceRegistry
- Update `default_llm_provider`/`default_stt_provider`/`default_tts_provider` in runtime settings
- Sessions created after config change use new provider; existing sessions continue with their current provider
- Fallback to mock if configured service fails health check
- `ServiceConfigCard.onSave` -> `PUT /api/v1/azure-config/services/{key}`
- `ServiceConfigCard.onTestConnection` -> `POST /api/v1/azure-config/services/{key}/test`
- Display real status from GET /services response
- Show toast notifications on save/test success/failure (already using `sonner`)

### Claude's Discretion
- Encryption key management approach (env var vs config)
- Exact error messages for connection test failures
- Retry/timeout strategy for Azure API calls
- Whether to add a "Reset to Mock" button per service

### Deferred Ideas (OUT OF SCOPE)
- Azure Content Understanding adapter (document analysis)
- Azure OpenAI Realtime adapter (real-time audio streaming)
- Azure Database for PostgreSQL configuration from UI (handled by deployment config)
- Avatar WebRTC rendering in frontend
- Per-session provider override (always use deployment-wide config for now)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-03 | Admin can configure Azure service connections (OpenAI, Speech, Avatar, Content Understanding) from web UI with connection testing | ServiceConfig DB model + CRUD API + real connection test endpoints + frontend wiring to existing ServiceConfigCard |
| ARCH-05 | Azure service connections are configurable per environment -- endpoints, keys, models, regions are config, not code | DB-persisted configuration that overrides env-based settings at runtime; Fernet encryption for API keys at rest |
| PLAT-05 | Voice interaction mode (STT/TTS vs GPT Realtime vs Voice Live) configurable per deployment and per session | Dynamic adapter switching in ServiceRegistry on config save; `default_*_provider` runtime update |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Async everywhere**: All backend functions must be `async def`
- **Pydantic v2** schemas with `model_config = ConfigDict(from_attributes=True)`
- **Alembic migrations required** for any schema change -- never modify DB directly
- **All models MUST use `TimestampMixin`** (UUID id + created_at + updated_at)
- **Service layer** holds business logic, routers only handle HTTP
- **No raw SQL** -- use SQLAlchemy ORM
- **Route ordering**: Static paths before parameterized (`/{id}`)
- **Create returns 201**, Delete returns 204
- **TypeScript strict: true** -- no `any` types
- **TanStack Query hooks** per domain, no inline `useQuery` in components
- **`@/` path alias** for all frontend imports
- **`cn()` utility** for conditional class composition
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`, `ci:`
- **Pre-commit checks**: `ruff check .`, `ruff format --check .`, `pytest -v` (backend); `npx tsc -b`, `npm run build` (frontend)
- **render_as_batch=True** in Alembic for SQLite compatibility
- **Ruff**: line-length 100, double quotes, Python 3.11 target

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 1.51.0 | Azure OpenAI client (`AsyncAzureOpenAI`) | Already a dependency; supports Azure endpoint/key/deployment natively |
| cryptography | 46.0.5 | Fernet symmetric encryption for API keys | Already installed via `python-jose[cryptography]`; no new dependency needed |
| azure-cognitiveservices-speech | >=1.48.0 | Azure Speech STT/TTS | Already in `[voice]` optional deps; adapters exist from Phase 06 |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sse-starlette | >=2.0.0 | Server-Sent Events for streaming | Used by sessions.py for SSE streaming; AzureOpenAI adapter will produce events consumed by same SSE endpoint |
| sqlalchemy[asyncio] | >=2.0.35 | Async ORM for ServiceConfig model | All DB access |
| pydantic-settings | >=2.5.0 | Runtime settings with env var defaults | Encryption key, default provider settings |

### New Dependencies
**None required.** All needed packages are already installed. The `cryptography` package provides Fernet and is a transitive dependency of `python-jose[cryptography]`. The `openai` package provides `AsyncAzureOpenAI`. Azure Speech SDK is in the `[voice]` optional group.

## Architecture Patterns

### Recommended Project Structure (New/Modified Files Only)
```
backend/
├── app/
│   ├── api/
│   │   └── azure_config.py          # MODIFY: Add PUT + enhance GET + real test
│   ├── models/
│   │   ├── __init__.py              # MODIFY: Add ServiceConfig export
│   │   └── service_config.py        # NEW: ServiceConfig ORM model
│   ├── schemas/
│   │   └── azure_config.py          # NEW: Pydantic schemas for config CRUD
│   ├── services/
│   │   ├── config_service.py        # NEW: Config CRUD + encryption + adapter switching
│   │   └── agents/
│   │       └── adapters/
│   │           └── azure_openai.py  # NEW: AzureOpenAIAdapter
│   └── utils/
│       └── encryption.py            # NEW: Fernet encrypt/decrypt helpers
├── alembic/
│   └── versions/
│       └── xxx_add_service_config.py # NEW: Migration
└── tests/
    ├── test_config_service.py       # NEW
    ├── test_azure_openai_adapter.py # NEW
    └── test_encryption.py           # NEW

frontend/
├── src/
│   ├── api/
│   │   └── azure-config.ts          # NEW: Typed API client for azure config endpoints
│   ├── hooks/
│   │   └── use-azure-config.ts      # NEW: TanStack Query hooks
│   ├── types/
│   │   └── azure-config.ts          # NEW: TypeScript types
│   └── pages/admin/
│       └── azure-config.tsx          # MODIFY: Wire to real API
```

### Pattern 1: ServiceConfig ORM Model
**What:** Database model storing per-service Azure configuration with encrypted API keys
**When to use:** Any Azure service configuration that needs to persist across restarts

```python
# backend/app/models/service_config.py
from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ServiceConfig(TimestampMixin, Base):
    """Azure service configuration stored in database."""

    __tablename__ = "service_configs"

    service_name: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(500), default="")
    api_key_encrypted: Mapped[str] = mapped_column(Text, default="")  # Fernet encrypted
    model_or_deployment: Mapped[str] = mapped_column(String(100), default="")
    region: Mapped[str] = mapped_column(String(50), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_by: Mapped[str] = mapped_column(String(36), default="")  # User ID
```

### Pattern 2: Fernet Encryption Utility
**What:** Symmetric encryption for API keys at rest using an env-var-sourced key
**When to use:** Encrypting/decrypting sensitive values stored in DB

```python
# backend/app/utils/encryption.py
from cryptography.fernet import Fernet

from app.config import get_settings


def _get_fernet() -> Fernet:
    """Get Fernet instance from settings encryption key."""
    settings = get_settings()
    return Fernet(settings.encryption_key.encode())


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string value, return base64-encoded token."""
    if not plaintext:
        return ""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(token: str) -> str:
    """Decrypt a Fernet token back to plaintext."""
    if not token:
        return ""
    f = _get_fernet()
    return f.decrypt(token.encode()).decode()
```

**Discretion: Encryption key management** -- Use an `encryption_key` field in `Settings` (pydantic-settings), defaulting to a generated key for development. In production, set via `ENCRYPTION_KEY` env var. Generate with `Fernet.generate_key().decode()`. This follows the existing pattern of `secret_key` for JWT.

### Pattern 3: AzureOpenAIAdapter (Streaming)
**What:** LLM adapter that wraps `AsyncAzureOpenAI` and yields `CoachEvent` objects
**When to use:** When Azure OpenAI is configured and active

```python
# backend/app/services/agents/adapters/azure_openai.py
from collections.abc import AsyncIterator

from app.services.agents.base import (
    BaseCoachingAdapter,
    CoachEvent,
    CoachEventType,
    CoachRequest,
)


class AzureOpenAIAdapter(BaseCoachingAdapter):
    """Azure OpenAI adapter for LLM coaching conversations."""

    name = "azure_openai"

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        deployment: str,
        api_version: str = "2024-06-01",
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._deployment = deployment
        self._api_version = api_version

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Execute Azure OpenAI chat completion with streaming."""
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=self._endpoint,
            api_key=self._api_key,
            api_version=self._api_version,
        )

        messages = [
            {"role": "system", "content": request.scenario_context},
            {"role": "user", "content": request.message},
        ]

        try:
            stream = await client.chat.completions.create(
                model=self._deployment,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=1024,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield CoachEvent(
                        type=CoachEventType.TEXT,
                        content=chunk.choices[0].delta.content,
                    )

            yield CoachEvent(type=CoachEventType.DONE, content="")

        except Exception as e:
            yield CoachEvent(
                type=CoachEventType.ERROR,
                content=f"Azure OpenAI error: {str(e)}",
            )
            yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        """Check if Azure OpenAI credentials are configured."""
        return bool(self._endpoint and self._api_key and self._deployment)
```

### Pattern 4: Dynamic Adapter Re-registration
**What:** On config save, instantiate and register the new adapter in ServiceRegistry
**When to use:** When admin saves a service configuration

```python
# In config_service.py
async def _register_adapter_from_config(config: ServiceConfig, api_key: str) -> None:
    """Register or update an adapter in the ServiceRegistry based on saved config."""
    from app.services.agents.registry import registry

    if config.service_name == "azure_openai":
        from app.services.agents.adapters.azure_openai import AzureOpenAIAdapter
        adapter = AzureOpenAIAdapter(
            endpoint=config.endpoint,
            api_key=api_key,
            deployment=config.model_or_deployment,
        )
        registry.register("llm", adapter)
        # Update runtime setting for new sessions
        settings = get_settings()
        settings.default_llm_provider = "azure_openai"
    elif config.service_name == "azure_speech_stt":
        from app.services.agents.stt.azure import AzureSTTAdapter
        adapter = AzureSTTAdapter(api_key, config.region)
        registry.register("stt", adapter)
        settings = get_settings()
        settings.default_stt_provider = "azure"
    # ... similar for TTS, Avatar
```

### Pattern 5: Real Connection Testing
**What:** Actually call the Azure service to verify connectivity
**When to use:** POST /test endpoint

```python
# For Azure OpenAI: lightweight chat completion with max_tokens=1
async def test_azure_openai(endpoint: str, api_key: str, deployment: str) -> tuple[bool, str]:
    """Test Azure OpenAI connection with a minimal API call."""
    from openai import AsyncAzureOpenAI

    client = AsyncAzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version="2024-06-01",
        timeout=10.0,
    )
    try:
        response = await client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": "test"}],
            max_tokens=1,
        )
        return True, "Connection successful"
    except Exception as e:
        return False, f"Connection failed: {str(e)}"

# For Azure Speech: list voices as health check
async def test_azure_speech(key: str, region: str) -> tuple[bool, str]:
    """Test Azure Speech connection."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list"
            response = await client.get(
                url,
                headers={"Ocp-Apim-Subscription-Key": key},
            )
            if response.status_code == 200:
                return True, "Connection successful"
            return False, f"HTTP {response.status_code}: {response.text[:200]}"
    except Exception as e:
        return False, f"Connection failed: {str(e)}"
```

### Anti-Patterns to Avoid
- **Mutating pydantic-settings directly:** `get_settings()` is cached via `@lru_cache`. You cannot mutate fields. Instead, store runtime overrides (like `default_llm_provider`) in a separate mutable runtime config dict or clear the lru_cache when configs change. The simplest approach: since `Settings` has `default_llm_provider = "mock"`, and the session SSE endpoint reads `settings.default_llm_provider`, the cleanest fix is to use a module-level mutable dict for runtime provider overrides rather than trying to mutate the frozen Settings object.
- **Creating AzureOpenAI client per-request:** The `AsyncAzureOpenAI` client is designed to be reused. Create it once when the adapter is instantiated, not on every `execute()` call. However, for simplicity with dynamic config changes (new endpoint/key), creating per-adapter-instance is fine -- just don't create per-request.
- **Storing plaintext API keys in DB:** Always use Fernet encryption. Never log decrypted keys.
- **Blocking the event loop with Azure Speech SDK:** The Azure Speech SDK is synchronous. Always use `asyncio.to_thread()` as the existing STT/TTS adapters do.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key encryption | Custom crypto, AES manual | `cryptography.fernet.Fernet` | Battle-tested, handles IV/padding/HMAC automatically |
| Azure OpenAI client | Raw HTTP calls to Azure | `openai.AsyncAzureOpenAI` | Handles auth, retries, streaming, API version quirks |
| Azure Speech testing | Manual WebSocket/REST | `httpx` GET to voices list endpoint | Simple health check, no SDK needed |
| SSE streaming | Custom streaming implementation | `sse-starlette.EventSourceResponse` | Already used in sessions.py, proven pattern |
| Key generation | Custom random bytes | `Fernet.generate_key()` | Produces correctly formatted URL-safe base64 key |

**Key insight:** Every Azure SDK integration point already has an established pattern in this codebase (mock adapter, Phase 06 Azure adapters). The AzureOpenAI adapter follows the same `BaseCoachingAdapter` interface. No new architectural concepts are needed.

## Common Pitfalls

### Pitfall 1: pydantic-settings @lru_cache Immutability
**What goes wrong:** Trying to mutate `settings.default_llm_provider` at runtime fails because `get_settings()` returns a cached, frozen-like object.
**Why it happens:** `@lru_cache` caches the Settings instance. Pydantic Settings objects do allow field assignment, but changes don't persist across `get_settings()` calls if the cache is cleared.
**How to avoid:** Use a separate `RuntimeConfig` singleton (simple dict or dataclass) for values that change at runtime. On startup, populate from Settings + DB. On config save, update the runtime config. The SSE endpoint reads from the runtime config instead of settings.
**Warning signs:** Tests pass but runtime provider doesn't switch after config save.

### Pitfall 2: Alembic render_as_batch for SQLite
**What goes wrong:** Migration fails with `ALTER TABLE` not supported error.
**Why it happens:** SQLite doesn't support many ALTER TABLE operations.
**How to avoid:** The project already uses `render_as_batch=True` in `alembic/env.py`. Just ensure new migrations use batch operations. Alembic autogenerate handles this automatically when `render_as_batch=True` is set.
**Warning signs:** Migration errors mentioning `ALTER TABLE`.

### Pitfall 3: Fernet Key Must Be URL-safe Base64
**What goes wrong:** `ValueError: Fernet key must be 32 url-safe base64-encoded bytes` when using a random string as encryption key.
**Why it happens:** Fernet requires a specific key format.
**How to avoid:** Always generate keys with `Fernet.generate_key()`. Store the result (a 44-char base64 string) in `ENCRYPTION_KEY` env var. Provide a default for dev: `Fernet.generate_key().decode()` called at module load time.
**Warning signs:** App crashes on startup with Fernet key validation error.

### Pitfall 4: ServiceRegistry Overwrites by Name
**What goes wrong:** Registering `MockCoachingAdapter` (name="mock") and then `AzureOpenAIAdapter` (name="azure_openai") in the same "llm" category works fine -- they coexist. But if you register a new `AzureOpenAIAdapter` instance with the same name, the old one is silently replaced.
**Why it happens:** `ServiceRegistry.register()` uses `adapter.name` as the dict key.
**How to avoid:** This is actually the desired behavior for dynamic re-registration. Just be aware that existing sessions referencing the old adapter instance will use the old adapter until their generator completes.
**Warning signs:** None -- this is expected behavior.

### Pitfall 5: Azure OpenAI API Version Mismatch
**What goes wrong:** Features like structured outputs or function calling don't work, or the API returns 404.
**Why it happens:** Azure OpenAI requires explicit `api_version` in every request. Different versions support different features.
**How to avoid:** Default to `2024-06-01` (GA, stable). Store `api_version` in the ServiceConfig or use a sensible default. Don't use preview versions in production unless needed.
**Warning signs:** 404 errors or unexpected response formats from Azure OpenAI.

### Pitfall 6: Existing Frontend Uses Local State Only
**What goes wrong:** After wiring `onSave` to the API, the component still initializes from hardcoded `AZURE_SERVICES` defaults instead of fetching from the backend.
**Why it happens:** The current `azure-config.tsx` uses `useState` with `AZURE_SERVICES` defaults. It never fetches from the backend.
**How to avoid:** Replace the `useState` initialization with a TanStack Query hook that fetches from `GET /api/v1/azure-config/services`. Fall back to defaults while loading.
**Warning signs:** Page always shows empty/default configs even after saving.

### Pitfall 7: Connection Test Timeout
**What goes wrong:** Test connection hangs for 30+ seconds when Azure endpoint is unreachable.
**Why it happens:** Default HTTP client timeout is too long for a UI-initiated test.
**How to avoid:** Use a 10-second timeout for connection tests. The `AsyncAzureOpenAI` client accepts a `timeout` parameter. For Speech, use `httpx.AsyncClient(timeout=10.0)`.
**Warning signs:** Frontend shows spinner indefinitely on test click.

## Code Examples

### Azure OpenAI Streaming with AsyncAzureOpenAI
```python
# Verified: openai 1.51.0 installed, AsyncAzureOpenAI constructor inspected
from openai import AsyncAzureOpenAI

client = AsyncAzureOpenAI(
    azure_endpoint="https://my-resource.openai.azure.com",
    api_key="my-key",
    api_version="2024-06-01",  # GA stable version
)

# Streaming chat completion
stream = await client.chat.completions.create(
    model="my-deployment-name",  # Azure uses deployment name, not model name
    messages=[
        {"role": "system", "content": "You are Dr. Chen..."},
        {"role": "user", "content": "Hello doctor..."},
    ],
    stream=True,
    temperature=0.7,
    max_tokens=1024,
)

async for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        content = chunk.choices[0].delta.content
        # yield CoachEvent(type=CoachEventType.TEXT, content=content)
```

### Fernet Encryption for API Keys
```python
# Verified: cryptography 46.0.5 installed, Fernet tested
from cryptography.fernet import Fernet

# Generate key (do once, store in env var)
key = Fernet.generate_key()  # Returns bytes like b'VKaG3xtPZVya...'
# Store key.decode() as ENCRYPTION_KEY env var

# Encrypt
f = Fernet(key)
token = f.encrypt(b"sk-abc123def456")  # Returns bytes
encrypted_str = token.decode()  # Store this in DB

# Decrypt
plaintext = f.decrypt(encrypted_str.encode()).decode()  # "sk-abc123def456"
```

### ServiceConfig Alembic Migration
```python
# Alembic migration pattern for new table
# Uses render_as_batch=True (already configured in env.py)
def upgrade() -> None:
    op.create_table(
        "service_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("service_name", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("endpoint", sa.String(500), server_default=""),
        sa.Column("api_key_encrypted", sa.Text, server_default=""),
        sa.Column("model_or_deployment", sa.String(100), server_default=""),
        sa.Column("region", sa.String(50), server_default=""),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("0")),
        sa.Column("updated_by", sa.String(36), server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
```

### Frontend API Client for Azure Config
```typescript
// frontend/src/api/azure-config.ts
import apiClient from "@/api/client";
import type { ServiceConfigResponse, ServiceConfigUpdate, TestResult } from "@/types/azure-config";

export async function getServiceConfigs(): Promise<ServiceConfigResponse[]> {
  const { data } = await apiClient.get<ServiceConfigResponse[]>("/azure-config/services");
  return data;
}

export async function updateServiceConfig(
  serviceName: string,
  config: ServiceConfigUpdate,
): Promise<ServiceConfigResponse> {
  const { data } = await apiClient.put<ServiceConfigResponse>(
    `/azure-config/services/${serviceName}`,
    config,
  );
  return data;
}

export async function testServiceConnection(serviceName: string): Promise<TestResult> {
  const { data } = await apiClient.post<TestResult>(
    `/azure-config/services/${serviceName}/test`,
  );
  return data;
}
```

### TanStack Query Hook for Azure Config
```typescript
// frontend/src/hooks/use-azure-config.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getServiceConfigs, updateServiceConfig, testServiceConnection } from "@/api/azure-config";

const QUERY_KEY = ["azure-config", "services"];

export function useServiceConfigs() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getServiceConfigs,
  });
}

export function useUpdateServiceConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceName, config }: { serviceName: string; config: ServiceConfigUpdate }) =>
      updateServiceConfig(serviceName, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useTestServiceConnection() {
  return useMutation({
    mutationFn: (serviceName: string) => testServiceConnection(serviceName),
  });
}
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 07) | Impact |
|------------------------|------------------------|--------|
| Config in `.env` only, read at startup | DB-persisted config, hot-reloadable | Admin can change Azure services without restarting server |
| `settings.default_llm_provider = "mock"` hardcoded | Runtime provider switching from DB | F2F sessions use real Azure OpenAI when configured |
| `Math.random()` for connection test | Real API calls with timeout | Admin gets actual connectivity status |
| Frontend `onSave` updates React state only | `PUT /api/v1/azure-config/services/{key}` | Config persists across browser sessions and server restarts |
| MockCoachingAdapter only for LLM | AzureOpenAIAdapter with streaming | Real AI-powered coaching conversations |

**Existing and reusable:**
- Azure STT adapter (`backend/app/services/agents/stt/azure.py`) -- already implemented in Phase 06
- Azure TTS adapter (`backend/app/services/agents/tts/azure.py`) -- already implemented in Phase 06
- Azure Avatar adapter (`backend/app/services/agents/avatar/azure.py`) -- stub from Phase 06, is_available()=False

## Open Questions

1. **Runtime Settings Mutation Strategy**
   - What we know: `get_settings()` uses `@lru_cache`, returning a cached instance. The session SSE endpoint reads `settings.default_llm_provider` to select the adapter.
   - What's unclear: Whether to (a) clear the lru_cache and recreate Settings, (b) use a separate mutable runtime config dict, or (c) directly mutate the cached Settings instance (Pydantic BaseSettings does allow attribute assignment).
   - Recommendation: Use approach (c) -- directly set attributes on the cached Settings instance. Pydantic BaseSettings allows this. Since `get_settings()` returns the same instance via lru_cache, mutations are visible everywhere. This is the simplest approach and matches how `settings` is already used as a module-level singleton throughout the codebase. If immutability is later needed, refactor to approach (b).

2. **Service Name Mapping Between Frontend and Backend**
   - What we know: Frontend uses keys like `openai`, `speechStt`, `speechTts`, `avatar`. Backend currently uses `azure_openai`, `azure_speech`, `azure_avatar`, `azure_content`.
   - What's unclear: Need a consistent mapping between frontend card keys and backend service_name values.
   - Recommendation: Use backend service_name as canonical: `azure_openai`, `azure_speech_stt`, `azure_speech_tts`, `azure_avatar`, `azure_content`. Map in the frontend API layer. This matches the adapter category/name pattern.

3. **Conversation History in AzureOpenAI Requests**
   - What we know: The current `sessions.py` SSE endpoint sends only a single message via `CoachRequest.message`. The mock adapter ignores conversation history. But for real AI coaching, the full conversation history is needed for coherent multi-turn dialogue.
   - What's unclear: Whether to add a `conversation_history` field to `CoachRequest` or fetch it inside the adapter.
   - Recommendation: Add a `conversation_history: list[dict] | None = None` field to `CoachRequest`. The session endpoint already has access to messages via `session_service.get_session_messages()`. Pass the full history so the Azure OpenAI adapter can construct a proper multi-turn messages array.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Yes | 3.11+ | -- |
| openai SDK | AzureOpenAI adapter | Yes | 1.51.0 | -- |
| cryptography | Fernet encryption | Yes | 46.0.5 | -- |
| azure-cognitiveservices-speech | Speech adapters | Optional | >=1.48.0 | Mock STT/TTS adapters |
| Node.js 20+ | Frontend build | Yes | 20+ | -- |
| Alembic | DB migrations | Yes | >=1.13.0 | -- |
| httpx | Speech connection testing | Yes | >=0.27.0 | -- |

**Missing dependencies with no fallback:**
- None -- all required dependencies are already installed.

**Missing dependencies with fallback:**
- `azure-cognitiveservices-speech` is in the `[voice]` optional group. If not installed, Speech STT/TTS adapters fall back to mock (conditional import pattern already used in Phase 06).

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- All canonical files read and analyzed:
  - `backend/app/services/agents/base.py` -- BaseCoachingAdapter interface, CoachEvent/CoachRequest dataclasses
  - `backend/app/services/agents/adapters/mock.py` -- MockCoachingAdapter reference implementation
  - `backend/app/services/agents/registry.py` -- ServiceRegistry singleton with register/get/list
  - `backend/app/api/sessions.py` -- SSE endpoint that consumes adapters
  - `backend/app/api/azure_config.py` -- Current read-only API stub
  - `backend/app/services/agents/stt/azure.py` -- Phase 06 AzureSTTAdapter (pattern reference)
  - `backend/app/services/agents/tts/azure.py` -- Phase 06 AzureTTSAdapter (pattern reference)
  - `backend/app/config.py` -- pydantic-settings with Azure env vars
  - `backend/app/main.py` -- Lifespan adapter registration
  - `frontend/src/pages/admin/azure-config.tsx` -- Frontend config page
  - `frontend/src/components/admin/service-config-card.tsx` -- Config card component

- **Runtime verification** -- Confirmed via Python execution:
  - `openai` v1.51.0 installed with `AsyncAzureOpenAI` class available
  - `AsyncAzureOpenAI` constructor accepts: azure_endpoint, api_key, api_version, azure_deployment, max_retries=2
  - `client.chat.completions.create` method available for streaming
  - `cryptography` v46.0.5 with working Fernet encrypt/decrypt verified
  - Fernet key format: 44-char URL-safe base64 string
  - Fernet token length: ~120 bytes for typical API key

### Secondary (MEDIUM confidence)
- **cryptography.io official docs** -- Fernet API, MultiFernet for key rotation, thread safety confirmed
- **openai-python GitHub README** -- AzureOpenAI constructor parameters, api_version format

### Tertiary (LOW confidence)
- Azure OpenAI API version recommendations (2024-06-01 GA, 2024-10-21 with structured outputs) -- based on training data knowledge, not verified against current Azure docs. Recommend using `2024-06-01` as a safe default.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified installed and working via runtime checks
- Architecture: HIGH -- patterns directly derived from existing codebase (MockCoachingAdapter, Phase 06 Azure adapters, ServiceRegistry)
- Pitfalls: HIGH -- identified from codebase inspection of real code patterns and gotcha list in CLAUDE.md
- Azure OpenAI streaming: HIGH -- AsyncAzureOpenAI constructor and chat.completions.create verified via Python introspection
- Encryption: HIGH -- Fernet encrypt/decrypt round-trip tested successfully
- API version: MEDIUM -- using known GA version but not verified against latest Azure docs

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- all dependencies pinned, patterns established)
