# Phase 16 Context: Voice Live Refactor — Modularize, Agent Mode, Sync

## User Requirements (原文)

1. Voice Live 功能模块化，不同菜单/功能项复用相同功能（平台核心非功能项）
2. Edit Voice Live Instance 页面后端，使用 Model 模式与 Voice Live 联通测试
3. HCP 页面使用 Agent 模式调用 Voice Live，调用前确认 HCP 已同步且有 agent-id
4. HCP 绑定的 Voice Live 配置需同步到 AI Foundry Agent（当前 portal 中 agent voice 配置为空）

## Key Findings from Research

### Current Gaps

1. **WebSocket proxy 只支持 Model 模式** — `voice_live_websocket.py` line 388 硬编码 model 模式，注释说 "agent mode requires Entra ID"（已被 POC 推翻）
2. **Agent sync 不读 VoiceLiveInstance 配置** — `build_voice_live_metadata()` 读的是 HcpProfile 的废弃 inline 字段，不用 `resolve_voice_config()`
3. **Avatar 配置不同步到 AI Foundry** — metadata 只含 voice/turn-detection/noise，无 avatar
4. **PCM 音频编码重复** — `voice-session.tsx` 和 `voice-test-playground.tsx` 各有一份相同的 Float32→Int16→base64 逻辑
5. **Voice 初始化流程重复** — initVoice/startTest ~50 行近乎相同
6. **Assign/Unassign 对话框重复 3 处** — management page、HCP editor、VL instance editor
7. **Avatar grid 渲染重复** — vl-instance-dialog 和 vl-instance-editor 各自定义
8. **常量定义重复** — VOICE_NAME_OPTIONS、TURN_DETECTION_TYPES 在两处独立定义
9. **SDK 版本过旧** — 当前 API version `2025-05-01-preview`，应升级到 SDK 1.2.0b5 (API `2026-01-01-preview`)
10. **VoiceLiveInstance 独有字段不同步** — response_temperature、proactive_engagement 等 7 个字段从不同步到 AI Foundry

### POC 结论 (2026-04-08 verified)

- API Key + Agent mode = **可行** (SDK >= 1.2.0b5, AgentSessionConfig via URL query params)
- API Key + Model mode = 可行 (现有行为)
- STS Token + Agent mode = 不可行 (401)
- Agent mode 使用 AI Foundry 预配置 instructions，不用代码传入的

### Architecture Decision

- **双模式 WebSocket**: HCP 有 synced agent_id → Agent 模式; 否则 → Model 模式 (fallback)
- **SDK 升级**: azure-ai-voicelive >= 1.2.0b5
- **前端透明**: Agent/Model 切换在后端 proxy 完成，前端无感知
- **Sync 修复**: build_voice_live_metadata() 改为使用 resolve_voice_config()，包含 avatar + VL Instance 字段

## Requirements Mapping

| ID | Requirement | Plan |
|----|------------|------|
| VL-16-01 | 前端 Voice Live 模块化：提取共享 utils/hooks/components | 16-01 |
| VL-16-02 | VL Instance Editor 后端 Model 模式联通测试 | 16-02 |
| VL-16-03 | WebSocket proxy 支持 Agent 模式 (SDK 1.2.0b5) | 16-02 |
| VL-16-04 | HCP 页面 Agent 模式预检 (agent sync status check) | 16-02 |
| VL-16-05 | Voice Live 配置同步到 AI Foundry Agent (含 avatar + VL Instance 字段) | 16-03 |
| VL-16-06 | 全量测试 + 构建验证 | 16-04 |
