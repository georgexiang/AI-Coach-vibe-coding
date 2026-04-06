# 02 — 数据库设计

## 核心模型

### VoiceLiveInstance（主表）

独立的 Voice Live 配置实体，可复用分配给多个 HCP Profile。

```python
# backend/app/models/voice_live_instance.py
class VoiceLiveInstance(TimestampMixin, Base):
    __tablename__ = "voice_live_instances"
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | String(36) UUID | auto | 主键 (TimestampMixin) |
| `name` | String(200) | required | 实例名称 |
| `description` | Text | nullable | 描述 |
| `enabled` | Boolean | True | 启用/禁用 |
| **Generative AI Model** | | | |
| `voice_live_model` | String(100) | "gpt-4o" | 模型 ID |
| `agent_instructions_override` | Text | nullable | 自定义 Agent 指令 |
| `response_temperature` | Float | nullable | 响应温度 (0.0-2.0) |
| `proactive_engagement` | Boolean | nullable | 主动对话 |
| **Speech Input** | | | |
| `recognition_language` | String(20) | nullable | 识别语言 |
| `auto_detect_language` | Boolean | nullable | 自动检测语言 |
| `turn_detection_type` | String(50) | "azure_semantic_vad" | VAD 类型 |
| `noise_suppression` | Boolean | True | 降噪 |
| `echo_cancellation` | Boolean | True | 回声消除 |
| `eou_detection` | Boolean | True | 结束检测 |
| **Speech Output** | | | |
| `voice_name` | String(100) | "zh-CN-XiaoxiaoMultilingualNeural" | TTS 声线 |
| `voice_type` | String(20) | "standard" | 声线类型 |
| `voice_temperature` | Float | nullable | 声线温度 |
| `voice_custom` | Text | nullable | 自定义语音 |
| `playback_speed` | Float | nullable | 播放速度 (0.5-2.0) |
| `custom_lexicon_enabled` | Boolean | nullable | 自定义词典 |
| `custom_lexicon_url` | String(500) | nullable | 词典 URL |
| **Avatar** | | | |
| `avatar_enabled` | Boolean | nullable | 启用数字人 |
| `avatar_character` | String(100) | nullable | 角色 ID |
| `avatar_style` | String(100) | nullable | 角色样式 |
| `avatar_customized` | Boolean | False | 自定义头像 |
| **审计** | | | |
| `created_by` | String(36) FK | nullable | 创建者 → users.id |
| `created_at` | DateTime | server_default | TimestampMixin |
| `updated_at` | DateTime | onupdate | TimestampMixin |

**关系**：`hcp_profiles = relationship("HcpProfile", back_populates="voice_live_instance")`

### HcpProfile（关联表）

HCP Profile 通过 FK 引用 VoiceLiveInstance。

```python
# backend/app/models/hcp_profile.py — Voice Live 相关字段
class HcpProfile(TimestampMixin, Base):
    # 推荐：引用 VoiceLiveInstance
    voice_live_instance_id = Column(String(36), ForeignKey("voice_live_instances.id"), nullable=True)
    voice_live_instance = relationship("VoiceLiveInstance", back_populates="hcp_profiles")

    # Deprecated 内联字段（向后兼容，优先级低于 VoiceLiveInstance）
    voice_live_enabled = Column(Boolean, default=False)
    voice_live_model = Column(String(100), default="gpt-4o")
    voice_name = Column(String(100), default="zh-CN-XiaoxiaoMultilingualNeural")
    # ... 等同于 VoiceLiveInstance 的字段子集

    # Agent 同步状态
    agent_id = Column(String(200), nullable=True)
    agent_version = Column(String(50), nullable=True)
    agent_sync_status = Column(String(20), default="none")  # none|pending|synced|failed
    agent_sync_error = Column(Text, nullable=True)
```

### ServiceConfig（服务配置表）

Voice Live 的 Azure 连接信息存储在通用服务配置表中。

```python
# backend/app/models/service_config.py
class ServiceConfig(TimestampMixin, Base):
    __tablename__ = "service_configs"

    service_name = Column(String(100))  # "azure_voice_live" | "ai_foundry" (master)
    endpoint = Column(String(500))
    api_key_encrypted = Column(Text)
    model_or_deployment = Column(String(200))
    region = Column(String(100))
    is_active = Column(Boolean, default=True)
    is_master = Column(Boolean, default=False)  # ai_foundry master config
```

**配置解析优先级**：
1. `azure_voice_live` 专用配置（如果存在且 `is_active`）
2. `ai_foundry` Master 配置（`is_master=True`，作为 fallback）

## 配置解析函数

```python
# backend/app/services/voice_live_instance_service.py
def resolve_voice_config(profile: HcpProfile) -> dict:
    """
    优先级: VoiceLiveInstance > HCP Profile 内联字段
    返回: 包含所有 voice/avatar 配置的扁平字典
    """
    if profile.voice_live_instance:
        inst = profile.voice_live_instance
        return {
            "voice_live_model": inst.voice_live_model,
            "voice_name": inst.voice_name,
            "avatar_character": inst.avatar_character,
            "avatar_style": inst.avatar_style,
            "avatar_enabled": inst.avatar_enabled,
            "turn_detection_type": inst.turn_detection_type,
            # ... 全部字段
        }
    else:
        return {
            "voice_live_model": profile.voice_live_model,
            "voice_name": profile.voice_name,
            # ... 从 deprecated 内联字段读取
        }
```

## ER 关系图

```
┌──────────────────┐       ┌───────────────────────┐       ┌──────────────┐
│  ServiceConfig   │       │  VoiceLiveInstance     │       │  HcpProfile  │
│                  │       │                       │  1:N   │              │
│ service_name     │       │ name                  │◄──────│ vl_instance_id│
│ endpoint         │       │ voice_live_model      │       │ agent_id     │
│ api_key_encrypted│       │ voice_name            │       │ agent_sync_  │
│ region           │       │ avatar_character      │       │   status     │
│ is_master        │       │ avatar_enabled        │       │ (deprecated  │
│                  │       │ turn_detection_type   │       │  inline VL   │
│ azure_voice_live │       │ response_temperature  │       │  fields)     │
│ ai_foundry       │       │ ...                   │       │              │
└──────────────────┘       └───────────────────────┘       └──────────────┘
```

## 迁移历史

| 迁移 | 文件 | 内容 |
|------|------|------|
| j13a | `j13a_add_voice_live_enabled_to_hcp_profile.py` | HCP 添加 `voice_live_enabled` |
| k14a | `k14a_add_voice_live_model_to_hcp_profile.py` | HCP 添加 `voice_live_model` 等内联字段 |
| m16a | `m16a_create_voice_live_instances.py` | **创建 VoiceLiveInstance 表** + HCP FK + 数据迁移 |
| n17a | `n17a_add_foundry_playground_fields.py` | 添加 Playground 字段（temperature, playback, lexicon, avatar_enabled） |

> **重要**：m16a 迁移包含数据迁移逻辑——为每个已有 HCP Profile 自动创建对应的 VoiceLiveInstance。
