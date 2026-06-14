# Azure 调试中发现的 Repo 代码问题

这份文档用于整理 Azure 部署/调试过程中确认的代码问题。格式保持简洁：**问题是什么、怎么解决、当前 git 状态**。

说明：

- `learn/` 当前是本地学习笔记目录，已被 git ignore，不会自动进入 commit。
- 后续开 PR 时，可以直接从本文复制对应问题的“问题 / 解决方式 / 验证”内容作为 PR 描述。
- 相关截图链接保留在各问题条目中。

## 总览

| 状态 | 问题 | 影响 | Git 状态 |
| --- | --- | --- | --- |
| 已解决 | PostgreSQL datetime / timezone 兼容 | Text Mode、Conference、Meta Skill sync 在 Azure PostgreSQL 上可能失败 | 本地分支 `fix/postgresql-timezone`，本地提交 `b7f6956`、`897147c` |
| 已解决 | PostgreSQL 低风险兼容项 | Analytics 查询、startup seed、部分 Alembic 写法在 PostgreSQL 上有风险 | 本地分支 `fix/postgresql-timezone`，本地提交 `897147c` |
| 已解决 | Blob Storage backend 未真正实现 | 云端材料/音频文件不能可靠持久化 | 本地分支 `feature/blob-storage-backend`，本地提交 `ab5302b` |
| 已解决 | Rubric 创建页前端崩溃 | Admin 无法打开 `/admin/scoring-rubrics/new` 创建 rubric | 本地分支 `fix/rubric-create-crash`，本地提交 `6399da4` |
| 已解决 | Skill Hub Quality Check AI 返回非 JSON | 云端 Quality Check 后台任务显示 AI Evaluation Error | 分支 `fix/skill-evaluator-json-output` 已提交并合入 `main`，提交 `62e214a`、`d6751f9` |
| 部分解决 | Voice Live SDK / API 兼容 | App 内 Voice Live 测试可能因 SDK 缺失或参数不兼容失败 | 本地分支 `fix/voice-live-sdk`，本地提交 `507284e`；仍需完整云端验证 |
| 已实现，待云端验证 | Infra security hardening | 云端 service keys 不写 DB、平台 secret 使用 Key Vault reference、PostgreSQL 支持 MI/Entra auth | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 已实现，待云端验证 | 部署期 app bootstrap | 云端部署后自动跑 Alembic migration 和幂等 sample data，不依赖 runtime startup `create_all()` | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 已解决，待云端验证 | SkillHub / Materials sample 为空 | 云端有 Sample Skill 但详情为空、Materials 占位符缺失 | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 已解决，待云端验证 | Voice Live agent mode SDK 参数不兼容 | HCP Voice & Avatar tab 可能报 `AgentSessionConfig` / SDK 版本错误 | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 已解决，待云端验证 | Voice Live Avatar gate 过严 | Voice Live Instance 已开 Avatar 但 App 以 `avatar=false` 创建 session，数字人不显示 | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 已解决，待云端验证 | Rubric Save / CU analyzer 返回 500 | CU analyzer 已创建/复用，但保存 rubric 返回 `MissingGreenlet` 500 | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 已实现，待云端验证 | Voice Live Instance sample data | 部署 bootstrap 后自动创建 4 个中/英文、男女 video avatar sample instances | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 未解决 | Voice Live model 下拉是静态列表 | Admin 看不到 Service Config 中实际 deployment | 待新分支/PR |
| 部分解决 | Azure 认证机制混合且 UI 不透明 | 后端 keyless/MI 路径增强，但 Admin UI 仍未完整展示实际 auth mode | 后端部分已随 `feat/infra-security-hardening` 提交 `22866fd` 推送；UI 透明度待新分支/PR |
| 已实现，待云端验证 | Secret 管理分散 | 本地保留 DB encrypted fallback；云端 Admin UI 可写 Key Vault，DB 只存非敏感配置 | `feat/infra-security-hardening` 已提交并推送到 `origin`，提交 `22866fd` |
| 未解决 | 本地 seed 流程不完整 | 按 README 启动后 Skill Hub / Scenarios 为空 | 待文档或 seed 脚本修复 |
| 部分解决 | Service Config 测试按钮诊断不可靠 | Connection tester 修复了 keyless/OpenAI client 与部分 key-only 误判，但诊断结构化仍未完成 | 部分修复已随 `feat/infra-security-hardening` 提交 `22866fd` 推送；完整诊断待新分支/PR |
| 部分解决 | 生产 PostgreSQL 启动 `create_all()` 风险 | 已加 `DATABASE_AUTO_CREATE_TABLES` 云端开关，但完整 Alembic migration 流程仍需补齐 | runtime gate 已随 `feat/infra-security-hardening` 提交 `22866fd` 推送；migration 治理待单独处理 |
| 暂不改 | SQLite FK enforcement | 本地 SQLite 默认不强制外键，和 PostgreSQL 行为不同 | 需单独评估，避免破坏本地行为 |

## 当前仍需后续处理的事项（2026-06-04 校准）

以下是真正还没有完成或仍需要单独 PR/云端验证的事项：

1. `feat/infra-security-hardening` 已提交并推送，但仍需要云端 what-if/deploy/bootstrap 验证后再合并。
2. Voice Live model 下拉仍是前端静态列表，需要改为读取真实 Azure deployment / Service Config。
3. Admin UI 仍未完整展示 Azure auth mode、key 来源、版本和最后更新时间。
4. Service Config 测试按钮仍缺少结构化诊断；部分 keyless/MI 误判已修，但完整诊断未做。
5. 本地 seed 文档/脚本仍不完整，README 快速启动后 Skill Hub / Scenarios 可能为空。
6. 生产 PostgreSQL 已有 `DATABASE_AUTO_CREATE_TABLES` gate，但完整 Alembic baseline / migration deploy 策略仍需单独处理。
7. SQLite FK enforcement 暂不改，后续要先在测试 DB 中评估影响。
8. Azure Speech STT/TTS runtime 仍未统一 MI/keyless；Test Connection 可 MI 成功，但独立 STT/TTS adapter 注册仍偏 key-based。
9. Voice score 失败、Retry URL 失败、i18n key 裸显仍未修复。

## 已解决问题

### 1. PostgreSQL datetime / timezone 兼容

**问题**

- 代码把 `datetime.now(UTC)` 这类 timezone-aware datetime 写入 SQLAlchemy `DateTime` 字段。
- PostgreSQL 字段实际是 `TIMESTAMP WITHOUT TIME ZONE`，asyncpg 会报类似：
  - `can't subtract offset-naive and offset-aware datetimes`
- 影响路径包括：
  - Training Text Mode / chat transcript。
  - Conference session。
  - Meta Skill sync。

**解决方式**

- 不改数据库 schema，短期统一采用 **naive UTC** 写入现有 `DateTime` 字段。
- 新增/扩展 `backend/app/utils/datetime.py`：
  - `utc_now_naive()`：生成写 DB 用的 naive UTC。
  - `as_utc_aware()`：读出 naive datetime 后按 UTC 参与 duration 计算。
  - `as_utc_naive()`：把可能带 offset 的 datetime 转成 DB 可比较/可写入的 naive UTC。
- 已修复相关写入路径：
  - `backend/app/services/session_service.py`
  - `backend/app/services/conference_service.py`
  - `backend/app/services/meta_skill_service.py`
  - `backend/scripts/seed_data.py`
- 已增加相关单元测试。

**Git 状态**

- 分支：`fix/postgresql-timezone`
- 本地提交：
  - `b7f6956 fix: use naive UTC timestamps for PostgreSQL`

**验证**

- 覆盖 datetime helper、session、conference、meta skill 相关测试。
- 本地 SQLite 行为保持不变，不需要重建本地 DB。

### 2. PostgreSQL 低风险兼容项

**问题**

- Analytics 查询中仍可能拿 timezone-aware datetime 和 DB `DateTime` 字段比较。
- startup seed 会在没有 published skill 时尝试创建无效 scenarios，PostgreSQL 会被 NOT NULL / FK 约束拦截。
- 部分 Alembic migration 使用 SQLite 友好的 boolean/default/datetime 写法，迁移到 PostgreSQL 有兼容风险。

**解决方式**

- `backend/app/services/analytics_service.py`
  - 查询时间窗口统一转 naive UTC。
- `backend/app/startup_seed.py`
  - seed scenarios 前先查 published skill。
  - 没有 published skill 时跳过 scenarios seed 并写日志。
  - 有 published skill/version 时填充 `skill_id` / `skill_version_id`。
- Alembic migrations
  - boolean default 改为 `sa.false()` / `sa.true()`。
  - data migration 写入时间改为 naive UTC。
  - 部分无法离线执行的数据查询逻辑做 online/offline 区分。

**Git 状态**

- 分支：`fix/postgresql-timezone`
- 本地提交：
  - `897147c fix: improve PostgreSQL compatibility`

**仍需后续处理**

- 生产 PostgreSQL 启动时 `create_all()` 的治理还没改，见“未解决问题”。
- 如果生产流程要求先生成 SQL 审批，数据依赖 migration 还需要单独拆分/制定 online migration 策略。

### 3. Blob Storage backend 未真正实现

**问题**

- Materials / audio storage 看起来有 storage abstraction，但 factory 实际写死返回 local backend。
- `AzureBlobStorageBackend` 原本是 stub，`save/read/delete/exists` 未实现。
- 云端 Container Apps 写本地文件系统不适合生产持久化和多实例运行。

**解决方式**

- 默认本地行为不变：
  - `STORAGE_BACKEND=local`
  - `MATERIAL_STORAGE_PATH=./storage/materials`
- 云端通过配置切换到 Blob：
  - `STORAGE_BACKEND=azure_blob`
  - `AZURE_STORAGE_ACCOUNT_URL=https://<storage-account>.blob.core.windows.net`
  - `AZURE_STORAGE_CONTAINER_NAME=materials`
- Blob backend 支持：
  - Managed Identity + account URL。
  - connection string fallback。
  - `save/read/delete/exists`。
  - 对同 container 的 blob URL 做 normalize，便于保存 URL 后继续 read/exists/delete。
- 增加 storage factory / Azure Blob backend 单元测试。

**Git 状态**

- 分支：`feature/blob-storage-backend`
- 本地提交：
  - `ab5302b feat: support Azure Blob storage backend`
- 注意：之前为了本地 Azure Bicep 验证修改过 `infra/azure/*`，但 `infra/` 当前是 ignored/local 内容，不在该 commit 中。最终 PR 前要决定是否把部署侧 Bicep 变更纳入版本管理。

**验证**

- storage/audio 定向测试通过。
- `az bicep build --file infra\azure\main.bicep` 曾通过本地验证。
- 完整 backend pytest 当时被既有 Foundry credential timeout 阻断，和 Blob 改动无关。

### 4. Rubric 创建页前端崩溃

**问题**

- 访问 `/admin/scoring-rubrics/new` 时报错：
  - `Unexpected Application Error`
  - `Cannot read properties of undefined (reading 'map')`
- 页面在调用后端创建 rubric / CU analyzer 前已经崩溃。

**截图证据**

![Rubric create undefined map error](images/rubric-create-undefined-map.png)

**根因**

- Rubric Editor 默认认为 `dimensions` 一定存在且是数组。
- 对已有 rubric 的 `criteria` 也默认认为一定是数组并直接 `.join()`。
- 一旦 create/edit 过程中遇到缺失字段，就会触发 `.map()` / `.join()` 崩溃。

**解决方式**

- 新增 `frontend/src/lib/rubric-form.ts` 统一做表单数据归一化。
- 缺失 `dimensions` 时自动回退到一个默认 dimension。
- `criteria` 不再直接假设一定是数组。
- 页面版和弹窗版 RubricEditor 都改用同一套 helper。
- 增加组件级和页面级回归测试。

**Git 状态**

- 分支：`fix/rubric-create-crash`
- 本地提交：
  - `6399da4 fix: prevent rubric editor crashes on missing dimensions`

**验证**

- `npm test -- --run src\components\admin\rubric-editor.test.tsx src\pages\admin\rubric-editor.test.tsx`
- `npx tsc -b`
- `npm run build`

## 部分解决问题

### 5. Skill Hub Quality Check AI 返回非 JSON

**问题**

- 云端 Skill Hub 里触发 Quality Check 后，接口 `POST /api/v1/skills/{skill_id}/evaluate-quality` 返回 202，后台任务开始执行。
- Azure AI Foundry Responses API 返回 HTTP 200，但后端随后报错：
  - `Agent evaluation failed: Expecting value: line 1 column 1 (char 0)`
  - traceback 指向 `backend/app/services/skill_evaluation_service.py` 的 `json.loads(content)`。
- 前端截图显示 Quality Check 结果为：
  - `AI Evaluation Error`
  - `Expecting value: line 1 column 1 (char 0)`

**截图证据**

![Skill quality check AI evaluation error](images/skill-quality-check-ai-evaluation-error.png)

> 截图来自本次云端调试对话中的 Quality Check 失败截图；如需长期保留图片文件，请把截图另存到上面的 `learn/images/` 路径。

**根因**

- `skill-evaluator` 的模板和 `output-schema.json` 规定输出应为 JSON。
- 但 agent instruction 是软约束，当前代码调用 Responses API 时没有启用 JSON 输出格式约束。
- 后端直接把 `response.output_text` 当成纯 JSON 调用 `json.loads(content)`，一旦模型返回空内容、普通文本或 Markdown 包裹内容，就会解析失败。

**解决方式**

- 在 `_call_agent_for_evaluation()` 调用 Responses API 时增加 JSON object 输出约束：
  - `text={"format": {"type": "json_object"}}`
  - 同时降低 temperature，减少格式漂移。
- 在用户 prompt 末尾追加明确格式要求：只返回 JSON object，不要 Markdown fence 或额外解释。
- 解析前先 `strip()`，并区分：
  - 空输出。
  - 非法 JSON。
  - 合法 JSON 但不是 object。
- 非法 JSON 时返回更清楚的错误信息和 response preview，避免只显示 `Expecting value`。
- 增加单元测试覆盖 JSON mode 参数、非法 JSON、非 object JSON。

**Git 状态**

- 分支：`fix/skill-evaluator-json-output`
- 本地/远端提交：
  - `62e214a fix: enforce JSON output for skill evaluator`
  - `d6751f9 fix: keep skill evaluator agent payload compatible`
- 当前 `main` 已包含该分支提交。

**验证**

- 计划运行：
  - `pytest tests/test_skill_evaluation_service.py -q`
  - `ruff check .`
  - `ruff format --check .`

### 6. Voice Live SDK / API 兼容

**问题**

- App 内 Voice Live 路径依赖 backend WebSocket proxy 和 `azure-ai-voicelive` Python SDK。
- 之前可能报：
  - `azure-ai-voicelive SDK not installed`
  - SDK agent mode 参数/API 不兼容。
- 本地如果只安装 `.[dev]`，云端 Docker 如果只安装 `.[postgresql]`，都可能漏装 voice extra。

**截图证据**

![Voice Live SDK missing error](images/voice-live-sdk-missing.png)

![Voice Live agent mode SDK version error](images/voice-live-agent-mode-sdk-version.png)

**已做**

- 分支 `fix/voice-live-sdk` 有本地提交：
  - `507284e fix: support Voice Live SDK agent parameters`
- 该提交涉及：
  - `README.md`
  - `backend/Dockerfile`
  - `backend/app/services/voice_live_websocket.py`
  - `backend/tests/test_voice_live_websocket.py`

**为什么只标“部分解决”**

- 还需要确认 Azure 部署使用的 Dockerfile / install extra 是否也包含 voice SDK。
- 还需要在真实 SDK 版本和云端环境里验证 backend WebSocket proxy 能成功启动 session。
- Voice Live model 下拉静态列表是另一个问题，尚未解决。

**后续建议**

- 明确本地 voice 开发安装命令，例如 `pip install -e ".[dev,voice]"`。
- 确认所有 backend image 构建路径都安装 voice extra。
- 用真实 `azure-ai-voicelive` 版本做 import/session config smoke test。
- 错误信息继续区分“SDK 未安装”和“SDK API/版本不兼容”。

### 7. Infra security hardening：Key Vault / service keys / PostgreSQL MI

**背景**

- 之前云端部署和运行时 secret 边界不够清晰：
  - 部署脚本会读取 Key Vault secret value，导致部署账号需要 Key Vault data-plane `secrets/get` 权限。
  - Admin UI 更新 Foundry / Azure service key 时，key 会进入数据库 `service_configs.api_key_encrypted`。
  - PostgreSQL 云端仍主要依赖 password-style `DATABASE_URL`，没有标准化 backend Managed Identity / Entra auth bootstrap 流程。
  - 生产环境启动时 `create_all()` 仍可能自动建表，和 migration/bootstrap 职责不清。

**本分支完成的任务**

- 分支：`feat/infra-security-hardening`
- 应用代码：
  - 新增 `SECRET_STORE=database|keyvault`。
  - 默认 `database`，本地行为不变：Admin UI 写入的 service key 继续 Fernet 加密后保存在 DB。
  - 云端 `keyvault`：Admin UI 更新固定 Key Vault secrets，DB 只保存 endpoint/model/region/project/is_active 等非敏感配置。
  - 新增 `backend/app/services/secret_store.py`，统一封装 DB encrypted store 和 Key Vault REST store。
  - `config_service`、`azure_config`、startup loader/seed 改为通过 secret store 读写 key。
  - Connection tester 修复 keyless/MI 兼容路径：
    - `test_azure_openai()` 正确导入 `AsyncAzureOpenAI`。
    - Speech/Avatar 在有 endpoint 时允许 DefaultAzureCredential fallback；没有 endpoint 时保留原来的“API key required”语义。
  - CU/Voice/Session 相关路径不再只因为 API key 为空就跳过，允许 MI/AAD auth 路径。
  - CU analyzer `409 ModelExists` 视为可复用成功，避免已存在 analyzer 时无法写回 `cu_voice_analyzer_id`。
  - 新增 `DATABASE_AUTH_MODE=password|azure_ad`。
  - 云端 `azure_ad` 模式下，SQLAlchemy asyncpg 连接动态注入 PostgreSQL Entra token，并配置 pool recycle 避免 token 过期复用。
  - 新增 `DATABASE_AUTO_CREATE_TABLES`，本地默认保持自动建表，云端可关闭，交给 bootstrap/migration。
- Infra 代码：
  - Container App 平台 secret 改用 Key Vault references：
    - `jwt-secret-key`
    - `encryption-key`
  - 部署脚本不再读取现有 Key Vault secret value；已有 Key Vault 时设置 `manageBootstrapSecrets=false`，避免部署更新时误轮换 bootstrap secrets。
  - Backend Managed Identity 获得 Key Vault secret 读写能力，以支持云端 Admin UI 更新 service key。
  - PostgreSQL Bicep 增加 Entra auth/admin 参数和 `authConfig`。
  - Container App 增加 cloud hardening env：
    - `DATABASE_AUTH_MODE`
    - `DATABASE_HOST`
    - `DATABASE_NAME`
    - `DATABASE_USER`
    - `DATABASE_AUTO_CREATE_TABLES`
    - `SECRET_STORE`
    - `AZURE_KEY_VAULT_URL`
  - `deploy.ps1` 增加 hardened 参数：
    - `-BackendDatabaseAuthMode azureAd`（云端脚本默认）
    - `-AzureServiceKeyStorage keyvault`（云端脚本默认）
    - `-PostgresEntraAdminLogin`
    - `-PostgresEntraAdminObjectId`
    - `-PostgresEntraAdminPrincipalType`
    - `-SkipDbBootstrap`
  - 如果未传 PostgreSQL Entra admin，`deploy.ps1` 默认使用当前 `az login` 用户作为 PostgreSQL Entra admin。
  - `deploy.ps1` 在 `azureAd` 模式 infra deploy 成功后默认自动运行 DB bootstrap；如果要手动处理 bootstrap，可传 `-SkipDbBootstrap`。
  - `main.bicep` 输出 PostgreSQL FQDN、database name 和 backend identity name，供部署脚本自动 bootstrap 使用。
  - 更新 `infra/azure/README.md`、`infra/azure/docs/parameters.md`、`infra/azure/main.parameters.example.json`。
- DB bootstrap：
  - 新增 `backend/scripts/bootstrap_postgres_entra.py`。
  - 该脚本由 PostgreSQL Entra admin / bootstrap identity 执行；新部署默认由 `deploy.ps1` 自动调用。
  - bootstrap 使用 backend Managed Identity 的 object id 调用 `pgaadauth_create_principal_with_oid(...)`，避免按 display name 查找时遇到租户内重名。
  - 负责创建 backend Managed Identity 对应 DB principal，并授予 connect/schema/table/sequence 权限。
  - Runtime backend MI 不需要 DB admin 权限。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。
- 注意：
  - `learn/` 是本地学习笔记，不应进入 upstream PR。
  - `infra/pytestresult.txt` 也不应进入 upstream PR，除非后续明确需要。

**验证**

- 已通过：
  - `az bicep build --file .\infra\azure\main.bicep`
  - PowerShell parser check for `infra\azure\scripts\deploy.ps1`
  - `python .\backend\scripts\bootstrap_postgres_entra.py --help`
  - `git diff --check`
  - Frontend：`npx tsc -b`
  - Frontend：`npm run build`
  - Backend targeted lint/format for touched hardening files。
  - Backend targeted tests：
    - `tests\test_config_service.py`
    - `tests\test_cu_evaluation_service.py`
    - `tests\test_connection_tester_ext.py`
    - `tests\test_connection_tester_extended.py`
    - 结果：`105 passed`
- 未完成：
  - 全量 backend `pytest` 没有跑完；当前 repo 收集到 2337 个测试，运行时间过长，已停止。
  - 尚未做真实 Azure what-if/deploy 验证。
  - 尚未在 Azure PostgreSQL 上实际验证自动 DB bootstrap。
  - 尚未验证云端 Admin UI 写 Key Vault 后，DB 中 `api_key_encrypted` 为空且 runtime 可正常读取 Key Vault fallback。

**仍需后续处理**

- 分支已提交并推送到 `origin/feat/infra-security-hardening`，下一步是从该远端分支开 PR 或继续做云端验证。
- 云端验证仍建议覆盖：
  - Azure `what-if`，确认 PostgreSQL Entra admin resource shape、Key Vault reference、Container App env wiring 都被 Azure 接受。
  - hardened cloud deploy：
    - infra deploy。
    - 确认自动 DB bootstrap 成功。
    - 运行/确认 migration 策略。
    - 验证 backend health。
    - 验证 Admin UI 更新 Foundry/service key 写入 Key Vault，不写 DB。
- 完整 Alembic migration 治理仍是单独任务；本分支只加了 `DATABASE_AUTO_CREATE_TABLES` 云端 gate 和 bootstrap 文档/脚本。

## `feat/infra-security-hardening` 本分支完整补充记录（含昨天和今天）

以下条目是在 `feat/infra-security-hardening` 上排查云端部署、Key Vault、PostgreSQL MI、Voice Live、SkillHub/Materials、Rubric/CU 时新增的改动。该分支已提交并推送到 `origin/feat/infra-security-hardening`，提交为 `22866fd chore: checkpoint infra hardening branch`。云端仍需要基于该提交重新构建 backend image 并运行部署 bootstrap 后才会完整生效。

### 本分支改动范围索引

**Infra / Azure 部署**

- `infra/azure/main.bicep`
- `infra/azure/main.parameters.example.json`
- `infra/azure/modules/container-apps.bicep`
- `infra/azure/modules/key-vault.bicep`
- `infra/azure/modules/managed-identity.bicep`
- `infra/azure/modules/postgresql.bicep`
- `infra/azure/modules/postgresql-entra-admin.bicep`
- `infra/azure/modules/role-assignments.bicep`
- `infra/azure/modules/ai-foundry.bicep`
- `infra/azure/modules/ai-openai.bicep`
- `infra/azure/scripts/deploy.ps1`
- `infra/azure/scripts/build-and-push.ps1`
- `infra/azure/scripts/test-region-availability.ps1`
- `infra/azure/README.md`
- `infra/azure/docs/parameters.md`

**Backend config / auth / secret / DB**

- `backend/.env.example`
- `backend/app/config.py`
- `backend/app/database.py`
- `backend/app/startup/database.py`
- `backend/app/startup/config_loader.py`
- `backend/app/api/azure_config.py`
- `backend/app/services/secret_store.py`
- `backend/app/services/config_service.py`
- `backend/app/services/connection_tester.py`
- `backend/scripts/bootstrap_postgres_entra.py`

**Migration / seed / bootstrap**

- `backend/alembic/env.py`
- `backend/alembic/versions/35e15f5ae427_add_service_config_table.py`
- `backend/alembic/versions/50811ca8b0f6_add_meta_skills_table.py`
- `backend/alembic/versions/i12b_add_voice_avatar_fields_to_hcp_profile.py`
- `backend/alembic/versions/j13a_add_voice_live_enabled_to_hcp_profile.py`
- `backend/alembic/versions/p19a_add_hcp_knowledge_configs.py`
- `backend/alembic/versions/q20a_add_dry_run_tables.py`
- `backend/alembic/versions/s22c_skill_id_not_null.py`
- `backend/alembic/versions/s22d_create_system_enums.py`
- `backend/alembic/versions/v25a_ensure_meta_skills_table.py`
- `backend/alembic/versions/v26a_skill_materials.py`
- `backend/scripts/bootstrap_app.py`
- `backend/scripts/seed_materials.py`
- `backend/app/startup_seed.py`
- `backend/.dockerignore`

**Voice / CU / scoring runtime**

- `backend/app/services/voice_live_websocket.py`
- `backend/app/services/voice_live_service.py`
- `backend/app/services/voice_scoring_service.py`
- `backend/app/services/cu_evaluation_service.py`
- `backend/app/services/session_service.py`
- `backend/app/services/rubric_service.py`
- `backend/app/schemas/scoring_rubric.py`

**Tests**

- `backend/tests/test_config_service.py`
- `backend/tests/test_coverage_boost.py`
- `backend/tests/test_cu_evaluation_service.py`
- `backend/tests/test_rubric_service.py`
- `backend/tests/test_voice_live_avatar_gate.py`
- `backend/tests/test_bootstrap_app_voice_live_seed.py`

**不应进入 PR / 需清理**

- `infra/pytestresult.txt`
- `learn/` 本地学习笔记目录（包括本文）。

### 0. Infra hardening 基础能力（昨天主要改动）

**问题**

- 云端部署存在几类生产化风险：
  - Container App platform secrets 和 Key Vault 边界不清。
  - 部署脚本会读取 Key Vault secret value，要求部署者具备 data-plane secret read 权限。
  - Admin UI 更新 Azure service key 时，key 会落到数据库加密字段。
  - PostgreSQL runtime 仍偏 password-style `DATABASE_URL`，backend Managed Identity / Entra auth 没有标准化。
  - DB role/grant bootstrap 缺少自动化。
  - Runtime app startup 和 deployment-time migration/bootstrap 职责混在一起。

**解决方式**

- Secret storage：
  - 新增 `SECRET_STORE=database|keyvault`。
  - 本地默认 `database`，保持原有 DB encrypted service key 行为。
  - 云端 `keyvault`，Admin UI 写固定 Key Vault secret，DB 只保存 endpoint/model/region/project/is_active 等非敏感配置。
  - 新增 `backend/app/services/secret_store.py`，统一封装 database 和 Key Vault secret store。
- Config service / Admin API：
  - `backend/app/services/config_service.py` 改为通过 secret store 读写 key。
  - `backend/app/api/azure_config.py` 更新 service config 时不再直接假设 key 一定写 DB。
  - `backend/app/startup/config_loader.py` / `backend/app/startup_seed.py` 兼容 keyvault 模式。
- PostgreSQL MI / Entra auth：
  - 新增 `DATABASE_AUTH_MODE=password|azure_ad`。
  - 云端 `azure_ad` 模式下，`backend/app/database.py` 为 asyncpg 连接动态获取 PostgreSQL Entra token。
  - 配置连接池 recycle，降低 token 过期复用风险。
  - 新增 `backend/scripts/bootstrap_postgres_entra.py`，用 PostgreSQL Entra admin 创建 backend Managed Identity DB principal 并授予权限。
- Runtime schema gate：
  - 新增 `DATABASE_AUTO_CREATE_TABLES`。
  - 本地/SQLite 默认保留 `create_all()` 便利行为。
  - 云端可关闭，让 schema 初始化交给 Alembic/bootstrap。
- Infra：
  - Container App secrets 改为 Key Vault references。
  - Backend Managed Identity 获得 Key Vault secret 读写权限。
  - PostgreSQL module 增加 Entra auth/admin 配置。
  - 新增 `postgresql-entra-admin.bicep`。
  - `deploy.ps1` 增加 hardened 参数和 DB bootstrap 调用。
  - `main.bicep` 输出 PostgreSQL FQDN、DB name、backend identity name 等给脚本使用。
  - 移除/整理默认 Bicep 管理的 realtime model deployment，保留 app/runtime 选择 GPT Realtime。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。
- 主要文件：
  - `backend/app/services/secret_store.py`
  - `backend/app/database.py`
  - `backend/app/config.py`
  - `backend/scripts/bootstrap_postgres_entra.py`
  - `infra/azure/main.bicep`
  - `infra/azure/modules/*.bicep`
  - `infra/azure/scripts/deploy.ps1`
  - `infra/azure/scripts/build-and-push.ps1`
  - `infra/azure/README.md`
  - `infra/azure/docs/parameters.md`

**验证**

- 已做过：
  - Bicep build。
  - PowerShell parser check。
  - `bootstrap_postgres_entra.py --help`。
  - 前端 typecheck/build。
  - backend config/CU/connection tester 定向测试。
- 仍需：
  - 完整 Azure what-if/deploy。
  - PostgreSQL Entra DB bootstrap 真实云端验证。
  - Admin UI 写 Key Vault 后 runtime 读取 Key Vault fallback 的真实验证。

### A. 部署期 app bootstrap：migration + sample data

**问题**

- 云端部署不能只依赖 backend runtime startup 自动 `create_all()`。
- 生产/演示环境需要明确的部署期步骤：
  - 先跑 Alembic migration。
  - 再跑幂等 sample data。
  - backend app 启动时不再负责生产 schema bootstrap。

**解决方式**

- 新增 `backend/scripts/bootstrap_app.py`。
  - `run_migrations()` 执行 `alembic upgrade head`。
  - `seed_samples()` 按依赖顺序运行 sample seed。
  - 支持 `--skip-migrations` 和 `--skip-seed`。
- `infra/azure/scripts/deploy.ps1` 增加 Container Apps Job bootstrap 流程。
  - 部署 backend image 后，更新/启动 backend bootstrap job。
  - 默认在 `-DeployApp` 后运行 migration 和 sample data。
  - 支持 `-SkipAppBootstrap`、`-SkipSampleData`。
- bootstrap job 使用 backend image 和 Managed Identity，在云端执行，而不是要求本地部署机器直接连生产 DB。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 文件：
  - `backend/scripts/bootstrap_app.py`
  - `infra/azure/scripts/deploy.ps1`
  - `infra/azure/modules/container-apps.bicep`
  - `infra/azure/README.md`
  - `infra/azure/docs/parameters.md`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。

**验证**

- 本地验证过 bootstrap script help / syntax。
- 云端实际 bootstrap job 已运行过，但期间暴露出 migration revision 过长问题，见下一条。

### B. SkillHub / Materials sample 为空

**问题**

- 云端 SkillHub 列表里有 Sample Skill，但点击详情内容为空。
- Materials 页面也为空，本来应有两个占位符材料。
- 部署 bootstrap job 一度失败：
  - `StringDataRightTruncationError: value too long for type character varying(32)`

**根因**

- 历史 migration `089e4862b719_add_skill_source_materials_junction_.py` 声称处理 `skill_source_materials`，但实际没有创建 junction table。
- 后续补偿 migration 的 revision id 曾写成 `v26a_ensure_skill_source_materials_table`，超过 PostgreSQL `alembic_version.version_num varchar(32)`，导致 bootstrap job 写版本号失败。
- `seed_materials` 原逻辑不适合部署 bootstrap 复用外部 session，也容易在缺 admin user 时静默失败。

**解决方式**

- 新增短 revision 补偿 migration：
  - `backend/alembic/versions/v26a_skill_materials.py`
  - 创建缺失的 `skill_source_materials` 表。
  - revision id 保持 `<= 32` 字符，兼容现有 PostgreSQL `alembic_version`。
- 新增/保留 `backend/alembic/versions/v25a_ensure_meta_skills_table.py`，保证 meta skills 表补齐。
- `backend/scripts/seed_materials.py`
  - 支持传入外部 `AsyncSession`。
  - 用 `get_storage().save()` 保存 placeholder PDF。
  - 缺 admin user 时 raise `RuntimeError`，不再静默吞掉。
- `backend/app/startup_seed.py`
  - seed materials 时复用当前 session。
  - Skill/Scenario seed 顺序更稳定。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 文件：
  - `backend/alembic/versions/v25a_ensure_meta_skills_table.py`
  - `backend/alembic/versions/v26a_skill_materials.py`
  - `backend/scripts/seed_materials.py`
  - `backend/app/startup_seed.py`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。

**验证**

- Alembic revision 长度检查通过：所有 revision id `<= 32`。
- 临时 SQLite `alembic upgrade head` 通过到 `v26a_skill_materials`。
- Materials / Skill list/detail / startup seed 相关定向测试曾通过，合计约 `53 passed`。

### C. Voice Live agent mode SDK 参数不兼容

**问题**

- Admin > HCP Profiles > Voice & Avatar tab 可能报：
  - `azure-ai-voicelive SDK >= 1.2.0b5 required for agent mode`
  - 或 `AgentSessionConfig` 相关错误。
- 用户训练页也可能只显示通用 toast：
  - `Failed to connect to voice service...`

**根因**

- 当前 `azure-ai-voicelive` SDK 已没有旧的 `AgentSessionConfig`。
- 新版 SDK 的 `connect()` 支持直接传：
  - `agent_name`
  - `project_name`
  - `agent_version`
  - `conversation_id`
- 旧代码仍按过时 API 创建 agent session config。

**解决方式**

- `backend/app/services/voice_live_websocket.py`
  - 移除 `AgentSessionConfig` 依赖。
  - agent mode 改为直接调用 SDK `connect(..., agent_name=..., project_name=...)`。
  - 保留对 Foundry agent mode 的错误日志和前端错误转发。
- 通过临时安装/检查真实 SDK signature 验证：
  - 有 `agent_name` / `project_name`。
  - 没有 `agent_config`。
  - 没有 `AgentSessionConfig`。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 文件：
  - `backend/app/services/voice_live_websocket.py`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。

**验证**

- Voice Live agent mode 的真实云端连接需要重新部署后验证。
- 本地真实 Azure SDK smoke test 因缺少真实 Azure env vars 被跳过。

### D. Voice Live Avatar gate 过严，导致数字人不显示

**问题**

- Voice Live Instance Playground 里已经选择 video avatar，但 App 仍不显示数字人。
- 云端日志显示：
  - `Voice Live connecting (model mode) ... avatar=False`
  - `session_modalities=['text','audio']`
  - `avatar_keys=[]`
  - `ice_servers=0`
- 这说明不是 WebRTC 握手失败，而是 backend 一开始就没启用 avatar modality。

**根因**

- 旧 gate 要求存在/启用单独 `azure_avatar` service config 行。
- 但 Voice Live Instance 自身已经有 `avatar_enabled=True` 和 avatar character/style。
- 云端 DB 如果没有 active `azure_avatar` 行，backend 会错误地把 avatar 关掉。

**解决方式**

- `backend/app/services/voice_live_websocket.py`
  - Avatar availability 改为由 Voice Live session/instance 配置决定。
  - 不再要求存在 standalone `azure_avatar` row。
  - `azure_avatar` 只作为默认 avatar character override 或兼容配置。
- `backend/app/services/voice_live_service.py`
  - `/voice-live/status` 和 token/status metadata 的 avatar availability 也改为基于 Voice Live 配置。
- 新增 `backend/tests/test_voice_live_avatar_gate.py`
  - 无 `azure_avatar` 行时，Voice Live Instance `avatar_enabled=True` 仍开启 Avatar。
  - Voice Live Instance `avatar_enabled=False` 时仍关闭 Avatar。
  - Voice Live-only 配置下 status 返回 `avatar_available=True`。
- 云端临时配置修复：
  - 通过 Admin API 启用 `azure_avatar` 行，让当前线上无需等 redeploy 也显示 `avatar_available=true`。
  - 代码修复后，新部署/新 DB 不应再依赖这条临时 DB 配置。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 文件：
  - `backend/app/services/voice_live_websocket.py`
  - `backend/app/services/voice_live_service.py`
  - `backend/tests/test_voice_live_avatar_gate.py`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。

**验证**

- `ruff format app\services\voice_live_websocket.py app\services\voice_live_service.py tests\test_voice_live_avatar_gate.py`
- `ruff check ...`
- `pytest -q tests\test_voice_live_avatar_gate.py`
- 结果：`3 passed`。

### E. Rubric Save / CU analyzer 返回 500

**问题**

- Admin Rubric 编辑页尝试 Save 后 toast：
  - `Could not save rubric. Check required fields and try again.`
- 云端日志显示：
  - CU analyzer PUT 返回 `409 Conflict`。
  - 后端正确记录 `CU analyzer ... already exists; reusing it`。
  - 随后 FastAPI response validation 报：
    - `MissingGreenlet`
    - `loc=('response','updated_at')`

**根因**

- `409 ModelExists` 不是失败，表示 analyzer 已存在，可以复用。
- 真正失败点是 `rubric_service.update_rubric()` 在 CU sync 后直接返回 ORM object。
- `updated_at` 等字段在 Pydantic response serialization 时触发 SQLAlchemy async expired attribute lazy load，脱离 greenlet 后报 `MissingGreenlet`。
- 同时发现 create/update rubric 没有保存前端传来的 `content_weight` / `voice_weight`。

**解决方式**

- `backend/app/services/cu_evaluation_service.py`
  - `409 ModelExists` 按成功复用处理。
- `backend/app/services/rubric_service.py`
  - create/update 保存 `content_weight` / `voice_weight`。
  - CU sync 后 `await db.refresh(rubric)`，保证 response serialization 需要的字段已加载。
- `backend/app/schemas/scoring_rubric.py`
  - `RubricUpdate` 也校验 `content_weight + voice_weight == 100`。
- `backend/tests/test_rubric_service.py`
  - 增加 create/update 权重持久化测试。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 文件：
  - `backend/app/services/cu_evaluation_service.py`
  - `backend/app/services/rubric_service.py`
  - `backend/app/schemas/scoring_rubric.py`
  - `backend/tests/test_cu_evaluation_service.py`
  - `backend/tests/test_rubric_service.py`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。

**验证**

- `ruff format app\schemas\scoring_rubric.py app\services\rubric_service.py tests\test_rubric_service.py`
- `ruff check app\schemas\scoring_rubric.py app\services\rubric_service.py tests\test_rubric_service.py`
- `pytest -q tests\test_rubric_service.py tests\test_rubrics_api.py`
- 结果：`28 passed`。

### F. Voice Live Instance sample data

**需求**

- 部署完成后自动创建几个 Voice Live Instance sample，方便直接测试 Playground。
- 用户明确要求：
  - 英文输入要英文 voice 输出。
  - 中文输入要中文 voice 输出。
  - 不做中英交叉组合。
  - Avatar 使用 video 里的人物。
  - Model 使用 UI 里的 `GPT Realtime`。

**实现**

- 在 `backend/scripts/bootstrap_app.py` 中新增 `seed_voice_live_instances(session)`。
- 只在部署 bootstrap sample data 路径执行，不放入本地 `startup_seed.py`，避免改变本地 startup 行为。
- 按 name 幂等创建，不重复、不覆盖已有同名实例。
- 创建 4 个 sample：

| Sample | 输入语言 | 输出语音 | Avatar | Model |
| --- | --- | --- | --- | --- |
| `Sample Voice Live - Chinese Female` | `zh-CN` | `zh-CN-XiaoxiaoNeural` | `lori` / `casual` video | `gpt-realtime` |
| `Sample Voice Live - Chinese Male` | `zh-CN` | `zh-CN-YunxiNeural` | `max` / `business` video | `gpt-realtime` |
| `Sample Voice Live - English Female` | `en-US` | `en-US-AvaNeural` | `lori` / `casual` video | `gpt-realtime` |
| `Sample Voice Live - English Male` | `en-US` | `en-US-AndrewNeural` | `max` / `business` video | `gpt-realtime` |

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 文件：
  - `backend/scripts/bootstrap_app.py`
  - `backend/tests/test_bootstrap_app_voice_live_seed.py`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。

**验证**

- `ruff format scripts\bootstrap_app.py tests\test_bootstrap_app_voice_live_seed.py`
- `ruff check scripts\bootstrap_app.py tests\test_bootstrap_app_voice_live_seed.py`
- `pytest -q tests\test_bootstrap_app_voice_live_seed.py`
- `pytest -q tests\test_startup_seed_postgres_compat.py tests\test_bootstrap_app_voice_live_seed.py`
- 结果：`3 passed`。

### G. Docker build context 排除本地 SQLite 临时文件

**问题**

- ACR build 本地上传 context 时可能失败：
  - `WinError 2 ... backend\ai_coach.db-shm`
- SQLite WAL/SHM 临时文件会随 DB 连接生命周期出现/消失，容易让 build 打包过程读到不存在的文件。

**解决方式**

- 新增 `backend/.dockerignore`。
- 排除本地 DB、WAL/SHM、venv、cache、env 等不应进入 backend image 的文件。

**Git 状态**

- 分支：`feat/infra-security-hardening`
- 文件：
  - `backend/.dockerignore`
- 本地提交/远端：`22866fd chore: checkpoint infra hardening branch`，已推送到 `origin/feat/infra-security-hardening`。

## 未解决问题

### 8. Voice Live model 下拉是前端静态列表

**问题**

- Admin 的 Voice Live Instance 编辑页里，`Generative AI Model` 下拉是写死选项，例如 GPT Realtime / GPT-4o / GPT-5。
- Service Config 里配置的真实 Azure OpenAI deployment，例如 `realtime1.5`，不会自动出现在下拉中。

**截图证据**

![Voice Live static model list](images/voice-live-static-model-list.png)

**解决方向**

- 前端不要只用静态 `VOICE_LIVE_MODEL_OPTIONS`。
- 从 Service Config 或后端 deployment/model API 获取可用 deployment。
- 保存时明确保存 Azure deployment 名称，而不是只保存静态模型枚举。

**Git 状态**

- 未修复，待新分支/PR。

### 9. Azure 认证机制混合且 UI 不透明

**问题**

- 当前不是纯 API Key，也不是纯 Managed Identity。
- 后端已有 `backend/app/services/azure_auth.py`，倾向 Managed Identity / Entra ID 优先、API Key fallback。
- 但部分 adapter / connection tester 仍然 key-heavy 或 key-only。
- Admin UI 看不到一次测试实际用了 `managed_identity` 还是 `api_key`。

**解决方向**

- 让 Azure service adapter 和连接测试统一接入 `azure_auth.py`。
- `is_available()` 不应只用 `api_key` 判断。
- API/UI 返回并展示认证方式，例如：
  - `managed_identity`
  - `api_key_fallback`
  - `api_key_only`

**Git 状态**

- 部分后端 keyless/MI 兼容已在 `feat/infra-security-hardening` 处理。
- Admin UI auth mode 透明度仍未修复，待新分支/PR。
- 详细说明见：`learn/azure-auth-access-mechanism.md`。

### 10. Secret 管理分散

**问题**

- 本地 `.env`、数据库 `service_configs.api_key_encrypted`、Container App secrets、Key Vault 之间职责不清。
- 云端 Key Vault 已存在，但当前 Container App runtime 不一定直接引用 Key Vault secret。
- Azure AI / Speech / CU / Realtime key fallback 如果继续保留，需要明确轮换、审计和来源。

**解决方向**

- 明确生产 secret 策略：
  - 首选 Managed Identity，不存服务 key。
  - 必须保留 key fallback 的服务纳入 Key Vault 或明确 DB 加密策略。
  - Admin UI 明确 key 来源。
- 统一命名映射：Key Vault secret、Container App secret、环境变量不要混用不清。

**Git 状态**

- 已在 `feat/infra-security-hardening` 实现主要生产路径，待云端验证。
- Admin UI 仍未完整展示 key 来源/版本/最后更新时间，可作为后续 UX/诊断任务。
- 详细说明见：`learn/azure-auth-access-mechanism.md`。

### 11. 本地 seed 流程不完整

**问题**

- 按 README Local Development 步骤执行 `scripts/init_db.py` 和 `scripts/seed_data.py` 后，Skill Hub / Scenarios 仍可能为空。
- `scripts/seed_data.py` 只创建基础用户、默认 rubric、HCP profiles、materials、历史会话等。
- Skill Hub 需要 `scripts/seed_skills.py`。
- Scenarios 需要 `scripts/seed_phase2.py`，且必须先有 published skill。

**临时 workaround**

```powershell
cd C:\Users\honzhao\AI-Coach-vibe-coding\backend
.\.venv\Scripts\Activate.ps1

# Terminal 1: keep backend running
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: seed Skill Hub first, then scenarios
python scripts\seed_skills.py
python scripts\seed_phase2.py
```

**解决方向**

- 更新 README Local Development seed 顺序。
- 或提供统一 `seed_demo.py` / `make seed`，自动处理依赖顺序。
- 生产/Azure 建议设置 `SEED_DATA_IGNORE=true`，避免 runtime 自动跑 demo/sample seed。

**Git 状态**

- 未修复，待文档或脚本 PR。

### 12. Service Config 测试按钮诊断不可靠

**问题**

- Azure Content Understanding runtime 在正确 endpoint / API version / header 下可以工作。
- 但 Admin > Service Config 的测试按钮可能误报失败，容易让人误判 CU 不可用。
- 其它服务的测试按钮也可能只测很窄的连通性，不代表真实 runtime 调用链可用。

**解决方向**

- CU API version 做成可配置项。
- 测试结果返回结构化诊断：
  - 最终 URL
  - API version
  - auth header 类型
  - HTTP status
  - Azure error code/message
- 多次 fallback 尝试时保留每次结果，不只展示最后一个错误。
- 测试逻辑尽量复用 runtime client/adapter。

**Git 状态**

- 部分修复在 `feat/infra-security-hardening`：
  - OpenAI connection tester 恢复正确 client import。
  - Speech/Avatar endpoint 存在时支持 keyless/MI fallback。
- 完整结构化诊断仍未修复，待新分支/PR。

### 13. 生产 PostgreSQL 启动 `create_all()` 风险

**问题**

- `backend/app/startup/database.py` 的 `init_tables()` 默认仍可调用 `Base.metadata.create_all()`。
- `backend/app/main.py` lifespan 启动仍会调用 `init_tables()`。
- 部分 seed/init 脚本也有 `create_all()`。
- 对本地 SQLite 方便，但生产 PostgreSQL 更应依赖 Alembic migration。

**这是什么意思**

- Alembic 是数据库 schema 版本管理工具，可以理解成“数据库结构的 Git”。
- `create_all()` 只会在缺表时建表；它不会给已有表自动加列、改列、删列、加约束，也不会记录数据库当前 schema 版本。
- `alembic upgrade head` 会按 `backend/alembic/versions/` 里的 migration 文件一步步把数据库结构升级到代码需要的版本，并记录当前版本。
- Azure PostgreSQL 是新架构，不是从本地 SQLite 迁移数据；这里的 migration 指的是“升级/初始化数据库结构”，不是迁移业务数据。

**如果不改会怎样**

- 短期 MVP/demo 可能还能跑：空 PostgreSQL 第一次启动时，`create_all()` 可能会把缺的表建出来。
- 长期风险在后续迭代：如果代码新增列、改字段、加约束，`create_all()` 不会更新已有表，云端可能出现 `column ... does not exist` 或 schema 与代码不一致。
- 如果数据库不是由 Alembic 管理，`alembic_version` 可能缺失或不准确，后续部署、回滚和排障会很难判断数据库到底处于哪个版本。
- 多个 backend 实例同时启动时，如果都尝试建表/seed，风险也更高。

**和 sample data 的关系**

- `create_all()` / Alembic 只负责表结构。
- sample data 由 `startup_seed` 或 seed scripts 负责。
- 解决这个问题不等于必须移除 sample data；如果要保留云端 demo 数据，可以在 Alembic 建好表之后继续跑 seed。
- 更稳的生产方式是：部署流程先跑 `alembic upgrade head`，再启动 backend；是否插入 demo/sample data 由明确的 seed 策略决定。

**当前进展**

- `feat/infra-security-hardening` 已新增 `DATABASE_AUTO_CREATE_TABLES`：
  - 本地/SQLite 默认保持自动建表便利路径。
  - 云端 hardened env 可设置为 `false`，避免 backend runtime 自动 `create_all()`。
- 这解决的是 runtime gate，不等于完整 migration 治理已经完成。

**为什么仍未完全解决**

- 还需要检查当前 Azure PostgreSQL 是否已经有 `alembic_version`。如果表已经存在但没有版本记录，可能需要先做 baseline/stamp，再进入标准 Alembic 流程。
- 所以完整 Alembic baseline / migration deploy step 更适合作为单独任务处理；当前分支只完成 runtime gate 和 bootstrap 指引。

**解决方向**

- SQLite/local：保留 `create_all()` 便利路径。
- PostgreSQL/prod：禁止 app startup 自动 `create_all()`，要求先执行 `alembic upgrade head`。
- Azure deploy script 中加入 migration step。

**Git 状态**

- 部分修复在 `feat/infra-security-hardening`。
- 完整 Alembic migration/baseline/deploy step 仍待单独处理。

### 14. SQLite FK enforcement

**问题**

- 本地 SQLite 默认不强制外键约束，一些引用/删除问题只会在 PostgreSQL 暴露。

**为什么暂不改**

- 直接开启 SQLite FK enforcement 会改变本地行为，可能让原来可运行的数据操作失败。

**解决方向**

- 先在测试 DB 中开启 FK enforcement，修复暴露的问题。
- 再评估是否改变本地开发默认行为。

**Git 状态**

- 暂不改，待单独兼容性任务。

## 当前证据下，不属于代码 bug 的点

### Foundry Playground 可以和已同步的 HCP profile 对话

这是预期行为。Foundry Playground 使用 Microsoft 托管的 portal/runtime，不依赖我们部署的 app backend container 是否安装 `azure-ai-voicelive`。

### Foundry Playground 可以看到 avatar

这也是预期行为。Foundry Portal 可以独立展示 avatar/playground 能力，不代表我们自己的 App Voice Live SDK 路径已经可用。

### HCP sync 成功，但 Voice Live 失败

这是可以同时发生的，因为两条链路依赖不同：

- HCP sync 使用 `azure-ai-projects`。
- Voice Live runtime 使用 `azure-ai-voicelive`。

## 建议后续 PR 顺序

1. 为已推送的安全加固集成分支 `feat/infra-security-hardening` 开 PR；合并前继续完成云端 what-if/deploy/bootstrap 验证。
2. 合并 PostgreSQL 兼容分支：`fix/postgresql-timezone`。
3. 合并 Blob Storage backend 分支：`feature/blob-storage-backend`，并决定是否纳入 Bicep 部署侧变更。
4. 合并 Rubric 创建页崩溃修复：`fix/rubric-create-crash`。
5. 继续验证/完善 Voice Live SDK 分支：`fix/voice-live-sdk`。
6. 新开分支处理 Voice Live model 下拉动态化。
7. 新开分支处理 Azure auth mode 展示和 Service Config 结构化诊断。
8. 新开分支处理 seed 文档/脚本和完整 Alembic migration 策略。
9. 新开分支统一 Azure Speech STT/TTS runtime 的 MI/keyless 认证路径。
10. 新开分支修复 voice score 的私有 Blob 访问、Retry URL 和 i18n key 覆盖问题。

## 待后续修复：Azure Speech STT/TTS runtime 未统一 MI/keyless

### 问题

管理页的 Azure Speech STT/TTS Test Connection 在没有填写 key 时可以通过 `DefaultAzureCredential` 使用 Entra ID / Managed Identity 测试成功，但实际 Conference 录音转写和独立 `/speech/transcribe`、`/speech/synthesize` runtime 仍走 key-based adapter。

这会造成“测试通过，但录音结束后 503 / Azure STT adapter 未注册”的体验不一致。

### 证据

- `backend/app/services/connection_tester.py` 的 `test_azure_speech()` 在没有 key 时会调用 `DefaultAzureCredential` 获取 bearer token。
- `backend/app/services/agents/stt/azure.py` 使用 `speechsdk.SpeechConfig(subscription=key, region=region)`。
- `backend/app/services/agents/tts/azure.py` 使用 `speechsdk.SpeechConfig(subscription=key, region=region)`。
- `backend/app/api/azure_config.py` 的 `register_adapter_from_config()` 只有在 `effective_key` 存在时才注册 `azure_speech_stt` / `azure_speech_tts` adapter。
- Voice Live WebSocket runtime 已支持无 key 时使用 `DefaultAzureCredential`；Voice Live Avatar 是 Voice Live session modality，不依赖独立 Avatar adapter。
- CU 主评分路径通过 `azure_auth.get_auth_headers()` AAD token 优先、API key fallback。

### 建议修复

将 Azure Speech STT/TTS runtime adapter 改为 MI/keyless-first、key fallback，并调整注册逻辑：当服务 active 且 endpoint/region/MI 可用时也允许注册 Azure Speech adapter，而不是只在 `effective_key` 存在时注册。

## 待后续修复：Voice score 失败、Retry 失败和 i18n key 裸显

### 问题

用户完成语音训练后，内容评分可以显示，但 Voice score 区域显示失败；点击 Retry 后也显示失败。同时 UI 显示 `voiceScore.title`、`voiceScore.failed`、`voiceScore.retry` 等 i18n key，而不是正常文案。

### 证据

- 云端部署中 `infra/azure/modules/container-apps.bicep` 设置后端 `STORAGE_BACKEND=azure_blob`。
- `infra/azure/modules/storage.bicep` 中 audio container 的 `publicAccess` 为 `None`，Blob 不公开。
- `backend/app/services/storage/azure_blob.py` 上传后返回 `container_client.get_blob_client(blob_name).url`，这是普通 Blob URL，不带 SAS。
- `backend/app/services/cu_evaluation_service.py` 的 `score_voice_with_cu()` 对 `https://...` 音频直接提交 `{"url": audio_url}` 给 Azure Content Understanding。
- 因此 CU 很可能无法读取私有 Blob 音频，导致 voice scoring background task 失败并把 `session.voice_score_status` 置为 `failed`。
- `frontend/src/components/scoring/voice-score-section.tsx` 使用 `apiClient.post('/api/v1/sessions/.../voice-score/retry')`，但 `frontend/src/api/client.ts` 已设置 `baseURL: '/api/v1'`，实际请求会变成 `/api/v1/api/v1/sessions/.../voice-score/retry`。
- `frontend/public/locales/en-US/scoring.json` 和 `frontend/public/locales/zh-CN/scoring.json` 中 `voiceScore` 同时被定义为对象和字符串，后面的字符串覆盖前面的对象，导致 `t('voiceScore.title')` 解析失败并裸显 key。

### 建议修复

- Voice scoring 音频访问：为 CU 提供可访问的临时 SAS URL，或改为 backend 读取 Blob 内容后用 CU 支持的 base64/data 上传方式，避免把私有 Blob 普通 URL 直接交给 CU。
- Retry URL：把 retry 请求路径改为 `/sessions/${sessionId}/voice-score/retry`，保持与 `apiClient` baseURL 约定一致。
- i18n：避免 `voiceScore` 同名 key 既作为对象又作为字符串；例如把字符串 key 改为 `voiceScoreLabel`，并保留 `voiceScore.title` 对象结构。

## 待后续处理：Content Understanding GA API 需要配置 completion model deployment

### 结论

已将 Content Understanding 从过期 Preview API 迁移到 GA API `2025-11-01`，并修复了 analyzer 同名替换问题：保存 rubric 时会使用 `allowReplace=true` 重新创建/替换 analyzer，且会等待 analyzer ready。部署后日志确认 `rubricVoiceb2a734ff` 已 `201 Created`、operation 成功、analyzer ready，Retry 时 `:analyze` 提交也已返回 `202 Accepted`。

当前剩余失败不再是 analyzer 找不到，而是 GA CU 分析阶段需要 completion model deployment：

```text
This analyzer needs a 'completion' model deployment for current request, but none was resolved.
Either 'models.completion' is not set on the analyzer, or the deployment it references is not registered for this resource.
Configure it via 'PATCH /contentunderstanding/defaults'.
```

### 原因

Preview API 时代 analyzer 看起来可以直接运行；GA API `2025-11-01` 下，使用 `method: "generate"` 的 custom analyzer 字段需要明确解析到 chat completion model deployment。我们的 voice analyzer 依赖 `generate` 字段生成 fluency/tone/pace/pronunciation/feedback_summary/transcript，因此绕不开 completion model。

GA analyzer 不会自动从 Foundry 资源里多个 deployment 中选择一个。它的解析链路是：

1. analyze 请求里的 `modelDeployments` override；
2. 否则使用 `/contentunderstanding/defaults` 配置的 `modelDeployments`；
3. analyzer `models.completion` 指向类似 `prebuilt-analyzer-completion` 的 alias，再由 defaults 映射到具体 deployment。

当前 Azure 资源里查到只有 `gpt-4o` deployment；官方 CU GA 支持列表中包含 `gpt-5.2`、`gpt-4.1`、`gpt-4.1-mini`、`gpt-4.1-nano` 等，未确认 `gpt-4o` 可用于 CU GA analyzer。

### 后续建议

暂不继续处理。以后恢复 voice scoring 时，优先选择以下路线之一：

1. 在 Foundry/CU 可用资源中部署 CU GA 支持的 chat completion model，例如 `gpt-4.1-mini` 或 `gpt-4.1`。
2. 配置 CU defaults，例如 `PATCH /contentunderstanding/defaults?api-version=2025-11-01`，将 `prebuilt-analyzer-completion` 映射到对应 deployment。
3. 或者改代码在每次 `:analyze` 请求 body 中传 `modelDeployments`，避免依赖 resource-level defaults。
4. 如果不想依赖 CU generate，则需要重构 voice scoring：CU 只做转写/基础音频处理，评分改由应用自己的 LLM scoring pipeline 完成。

## PR 描述使用方式

开 PR 时建议从对应条目复制：

- **Problem**：复制“问题”。
- **Solution**：复制“解决方式”。
- **Validation**：复制“验证”。
- **Notes / Follow-up**：复制“仍需后续处理”或“后续建议”。

例如 Rubric PR 可以写：

- Problem：Rubric create/edit code assumed `dimensions` and `criteria` were always arrays, causing `/admin/scoring-rubrics/new` to crash on missing fields.
- Solution：Added shared rubric form normalization helpers and default dimension fallback; updated page and dialog editors to use them.
- Validation：Targeted Vitest rubric editor tests, TypeScript build, and frontend production build passed.
