# 02 — 成本对比分析

> CU 与 LLM 的定价模型对比、单次评分成本估算、规模化场景下的总成本预测。
>
> 定价数据来源: [Azure CU Pricing Update (2025-05)](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/what-if-you-could-cut-ai-costs-by-60-without-losing-quality/4430880)
> 及 [Azure OpenAI Pricing](https://azure.microsoft.com/pricing/details/azure-openai/)

---

## 1. CU 定价模型 (2025-05 新版 Token-Based)

CU 定价由三部分组成:

### 1.1 Content Extraction (内容提取)

| 模态 | 单位 | 价格 |
|------|------|------|
| 文档 | 每 1,000 页 | $5.00 |
| 音频 | 每小时 | $0.36 |
| 视频 | 每小时 | $1.00 |
| 视频人脸识别附加 | 每小时 | $2.00 |

**非分页文档规则:** TXT/HTML/MD/JSON 等，每 3,000 UTF-16 字符 = 1 页。

### 1.2 Field Extraction (字段提取/生成)

| 模式 | Token 类型 | 每 1M tokens |
|------|-----------|-------------|
| **Standard** | Input Tokens | $2.75 |
| **Standard** | Output Tokens | $11.00 |
| **Pro** | Input Tokens | $1.21 |
| **Pro** | Output Tokens | $4.84 |

### 1.3 Contextualization (上下文化)

| 模态 | Contextualization Tokens | 等效价格 |
|------|-------------------------|---------|
| 1 页文档 | 1,000 tokens | $1 / 1000 页 |
| 1 张图片 | 1,000 tokens | $1 / 1000 张 |
| 1 小时音频 | 100,000 tokens | $0.10 / 小时 |
| 1 小时视频 | 1,000,000 tokens | $1.00 / 小时 |

Standard: $1.00/1M contextualization tokens
Pro: $1.50/1M contextualization tokens

---

## 2. LLM 定价模型 (Azure OpenAI)

| 模型 | Input (每 1M tokens) | Output (每 1M tokens) |
|------|---------------------|---------------------|
| GPT-4o | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| GPT-4.1 | $2.00 | $8.00 |
| GPT-4.1-mini | $0.40 | $1.60 |
| o3-mini | $1.10 | $4.40 |

---

## 3. 单次评分成本估算

### 3.1 场景假设

一个典型的 AI Coach 训练 session:
- **对话轮次:** 10-20 轮 (MR + HCP 各 10 条消息)
- **Transcript 长度:** ~3,000 - 8,000 字符 (中英混合)
- **Token 数 (输入):** ~2,000 - 5,000 tokens
- **音频时长:** 5-15 分钟
- **评分输出:** ~500-1,500 tokens (5 维度 JSON)

### 3.2 CU 内容评分成本 (当前实现)

```
Transcript JSON: ~5,000 字符 ≈ 2 页 (按 3000 字符/页)

Content Extraction:    2 页 × ($5.00/1000) = $0.01
Contextualization:     2 × 1000 tokens × ($1.00/1M) = $0.002
Field Extraction:
  - Input:  ~3,000 tokens × ($2.75/1M) = $0.008
  - Output: ~1,000 tokens × ($11.00/1M) = $0.011

单次内容评分 ≈ $0.03
```

### 3.3 CU 语音评分成本

```
音频: 10 分钟 = 0.167 小时

Content Extraction:    0.167h × $0.36/h = $0.06
Contextualization:     0.167 × 100,000 × ($1.00/1M) = $0.017
Field Extraction:
  - Input:  ~5,000 tokens × ($2.75/1M) = $0.014
  - Output: ~800 tokens × ($11.00/1M) = $0.009

单次语音评分 ≈ $0.10
```

### 3.4 LLM 内容评分成本 (推荐方案)

```
使用 GPT-4o:

Scoring Prompt (system + user):
  - System msg: ~200 tokens
  - HCP Profile: ~300 tokens
  - Scenario context: ~200 tokens
  - Key messages + status: ~400 tokens
  - Transcript: ~3,000 tokens
  - Dimensions + criteria: ~500 tokens
  - 总 input: ~4,600 tokens

Output (JSON): ~1,200 tokens

Cost:
  - Input:  4,600 × ($2.50/1M) = $0.012
  - Output: 1,200 × ($10.00/1M) = $0.012

单次 LLM 内容评分 (GPT-4o) ≈ $0.024
```

```
使用 GPT-4o-mini (更经济):

  - Input:  4,600 × ($0.15/1M) = $0.0007
  - Output: 1,200 × ($0.60/1M) = $0.0007

单次 LLM 内容评分 (GPT-4o-mini) ≈ $0.0014
```

### 3.5 单次评分成本对比

| 方案 | 内容评分 | 语音评分 | 总计 | 准确性 |
|------|---------|---------|------|--------|
| CU 全覆盖 (当前) | $0.03 | $0.10 | **$0.13** | ❌ 内容评分不准 |
| LLM 内容 + CU 语音 (推荐) | $0.024 | $0.10 | **$0.124** | ✅ 两者都准 |
| LLM-mini 内容 + CU 语音 | $0.0014 | $0.10 | **$0.101** | ✅ 省钱且准 |
| 纯 LLM (GPT-4o) | $0.024 | $0.024 | **$0.048** | ⚠️ 语音质量LLM无法评估 |
| 纯 LLM-mini | $0.0014 | $0.0014 | **$0.003** | ⚠️ 便宜但语音不可评 |

---

## 4. 规模化成本预测

### 假设: BeiGene MR 培训规模

| 指标 | 值 |
|------|-----|
| MR 数量 | 500 人 |
| 每人每月 session 数 | 10 次 |
| 月总 session 数 | 5,000 次 |
| 含音频的比例 | 60% (3,000 次) |
| 纯文本比例 | 40% (2,000 次) |

### 月度成本估算

| 方案 | 纯文本 session | 含音频 session | 月总计 | 年总计 |
|------|---------------|---------------|--------|--------|
| CU 全覆盖 (当前) | 2000×$0.03 = $60 | 3000×$0.13 = $390 | **$450** | **$5,400** |
| LLM + CU 语音 (推荐, GPT-4o) | 2000×$0.024 = $48 | 3000×$0.124 = $372 | **$420** | **$5,040** |
| LLM-mini + CU 语音 | 2000×$0.0014 = $2.8 | 3000×$0.101 = $303 | **$306** | **$3,672** |

### 关键发现

1. **CU 和 LLM 的内容评分成本几乎相同** — CU ($0.03) vs GPT-4o ($0.024)，差距微小
2. **语音评分是主要成本来源** — $0.10/次 占总成本的 75%+
3. **用 GPT-4o-mini 替代 GPT-4o 可大幅降低内容评分成本** — $0.024 → $0.0014 (降 94%)
4. **CU 在内容评分上没有成本优势，且准确性远不如 LLM**

---

## 5. 非金钱成本考量

### 5.1 延迟

| 引擎 | 典型延迟 | 用户体验影响 |
|------|---------|-------------|
| CU Content | 5-15s (submit + poll) | 可接受 |
| CU Voice | 10-30s (音频处理较慢) | 可接受 (异步) |
| LLM GPT-4o | 3-8s | 更快 |
| LLM GPT-4o-mini | 1-3s | 最快 |

### 5.2 可靠性

| 引擎 | 可用性 | 失败处理 |
|------|--------|---------|
| CU | 依赖单一 Azure 服务 | 轮询超时 = 失败 |
| LLM | Azure OpenAI 高可用 | 重试 + 降级 |

### 5.3 开发维护成本

| 引擎 | 维护复杂度 | 说明 |
|------|-----------|------|
| CU | 高 | Analyzer 同步、版本隔离、Portal 问题、API 迁移 |
| LLM | 低 | 维护 prompt template 即可，标准 OpenAI API |

### 5.4 可控性与调试

| 引擎 | 可调试性 | 说明 |
|------|---------|------|
| CU | ❌ 差 | 无中间结果、无推理过程、黑盒 |
| LLM | ✅ 好 | 可加 `reasoning` 字段、可调 temperature、可 few-shot |

---

## 6. 成本结论

### 推荐策略: **LLM 内容评分 + CU 语音评分**

| 维度 | 推荐 | 原因 |
|------|------|------|
| 内容评分 | GPT-4o 或 GPT-4o-mini | 准确度远高于 CU，成本持平或更低 |
| 语音评分 | CU (prebuilt-audio) | 原生音频分析能力，LLM 无法直接评估音频信号 |

**成本不是阻碍 LLM 评分的因素。** 真正决定使用哪个引擎的是**能力适配性**:
- LLM 能理解复杂上下文 → 做内容评分
- CU 能处理音频信号 → 做语音质量评分
