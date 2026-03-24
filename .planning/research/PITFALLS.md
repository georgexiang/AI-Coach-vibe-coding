# Domain Pitfalls

**Domain:** AI-powered pharma MR training platform (Azure PaaS, real-time voice, avatar, multi-region)
**Researched:** 2026-03-24
**Overall Confidence:** HIGH (verified against official Microsoft documentation, March 2026)

---

## Critical Pitfalls

Mistakes that cause rewrites, major delays, or architectural dead-ends.

### Pitfall 1: Azure AI Avatar Is NOT Available in China (21Vianet)

**What goes wrong:** The team builds the entire HCP visual experience around Azure AI Avatar, then discovers it cannot be deployed to China. Text-to-speech Avatar is explicitly listed as **unsupported** in Azure operated by 21Vianet (sovereign cloud). The China deployment has NO avatar, NO custom voice, NO personal voice, NO Voice Live, and NO LLM speech.

**Why it happens:** Teams assume Azure feature parity across regions. Azure China (21Vianet) is a physically separate cloud with drastically reduced AI service coverage. The official sovereign cloud documentation confirms Avatar is unsupported.

**Consequences:**
- China MR users get a completely different (degraded) experience
- If Avatar is the primary HCP visual, China deployment requires a full alternative UI path
- Late discovery means re-architecture and scope creep

**Prevention:**
- Design a **two-tier HCP visual system from day 1**: Avatar (global regions) + fallback (China)
- Fallback options: static HCP portrait with animated speech bubbles, or a simple 2D character with CSS lip-sync animation
- Abstract the HCP visual layer behind an interface so the rendering strategy is swappable per deployment region
- The PROJECT.md already notes "implement as configurable option, fall back to Azure Speech TTS" -- enforce this strictly

**Detection:** Check the sovereign cloud docs page early. If anyone says "we'll add China support later," flag it immediately.

**Affected phase:** Phase 1 (Architecture) -- must design the abstraction layer before any Avatar code is written.

**Confidence:** HIGH -- verified via https://learn.microsoft.com/en-us/azure/ai-services/speech-service/sovereign-clouds

---

### Pitfall 2: Azure OpenAI Is Not Available in Azure China (21Vianet)

**What goes wrong:** The core AI coaching engine uses Azure OpenAI (GPT-4o, GPT Realtime). Azure OpenAI is NOT listed as available in Azure China 21Vianet regions. The China deployment has no Azure OpenAI service.

**Why it happens:** Azure China service catalog does not include Azure OpenAI. The service availability page for 21Vianet does not list Azure OpenAI among available AI services. Teams working on global Azure assume OpenAI is universally available.

**Consequences:**
- The entire coaching conversation engine, scoring, and real-time voice interaction cannot run in China using the same stack
- Requires either: (a) routing China traffic to a global Azure region (data residency violation), (b) using a different LLM provider in China (e.g., Zhipu AI, Baidu Wenxin, or self-hosted), or (c) negotiating special access through Microsoft China sales

**Prevention:**
- Design the AI adapter layer (already in architecture) to be provider-agnostic from the start
- Implement a China-specific AI adapter that uses a domestic Chinese LLM provider
- Contact Microsoft China sales EARLY to determine if Azure OpenAI access can be arranged through special agreement (some enterprise customers have access via direct engagement)
- Keep the BaseCoachingAdapter pattern strict -- all LLM calls must go through the adapter, never direct API calls

**Detection:** If the team cannot provision an Azure OpenAI resource in chinaeast2/chinanorth2/chinanorth3, this is confirmed. Research this during the first week.

**Affected phase:** Phase 1 (Architecture) -- the adapter pattern is the mitigation. Phase 2+ must test with mock adapters for China path.

**Confidence:** MEDIUM -- I could not find Azure OpenAI explicitly listed for 21Vianet. Microsoft may offer it through direct enterprise agreements not documented publicly. Flag for validation with Microsoft account team.

---

### Pitfall 3: Realtime API Rate Limits Are Brutally Low

**What goes wrong:** The team builds for concurrent MR training sessions, then hits the wall: `gpt-4o-realtime-preview` has a default quota of only **36 RPM** (requests per minute) and **6,000 TPM** (tokens per minute) at Tier 1. Even at Tier 6, the limit is only **54 RPM / 9,000 TPM**. The newer `gpt-realtime` GA model tops out at **200-300 RPM / 100,000-150,000 TPM**.

**Why it happens:** Realtime audio models consume significantly more resources than text models. Azure enforces much tighter quotas. Teams used to text model limits (thousands of RPM) are blindsided.

**Consequences:**
- With 36 RPM, you can support roughly 3-5 concurrent real-time voice sessions (each session makes multiple requests)
- Organization-wide rollout (hundreds of MRs) is impossible without quota increases or architectural changes
- Rate limit errors during a training session destroy the user experience

**Prevention:**
- Use `gpt-realtime` (GA, 2025-08-28) or `gpt-realtime-1.5` (2026-02-23) instead of preview models -- they have 200 RPM base quota
- Request quota increases via the Azure quota form BEFORE building concurrent session features
- Implement session queuing: limit concurrent real-time sessions and queue additional users
- Implement a **hybrid approach**: use real-time voice for F2F coaching, but use standard text completion + separate TTS for conference mode (where real-time is less critical)
- Build client-side audio buffering to minimize round-trips
- Monitor `x-ratelimit-remaining-*` headers and implement graceful degradation

**Detection:** Test with 10 concurrent sessions in dev. If you see 429 errors, you have hit the wall.

**Affected phase:** Phase 2 (Voice Integration) -- must choose the right model and request quotas. Phase 4 (Scaling) -- load testing.

**Confidence:** HIGH -- verified via https://learn.microsoft.com/en-us/azure/ai-services/openai/quotas-limits (updated 2026-03-21)

---

### Pitfall 4: Realtime API Must NOT Connect Directly to End-User Devices

**What goes wrong:** The frontend attempts to open a WebSocket directly from the browser to Azure OpenAI Realtime API. This violates the documented architecture: "The Realtime API is NOT designed to connect directly to end-user devices."

**Why it happens:** Developers see WebSocket in the API docs and assume browser-to-API is the intended pattern. The Azure docs explicitly state you need an intermediary.

**Consequences:**
- API keys exposed in browser JavaScript (security breach)
- No ability to moderate, log, or score conversations server-side
- Connection instability on mobile/poor networks
- Violates the pharma compliance requirement for auditable training paths (NFR-1)

**Prevention:**
- Architect a **server-side relay**: Browser <-> WebSocket <-> FastAPI backend <-> Azure OpenAI Realtime API
- Use WebRTC for the browser-to-server leg (~100ms latency) and WebSocket for server-to-Azure (~200ms latency)
- The backend relay enables: conversation logging, real-time scoring injection, content moderation, key management
- FastAPI supports WebSocket natively via Starlette

**Detection:** If any code imports the OpenAI Realtime SDK in frontend code, flag immediately.

**Affected phase:** Phase 1 (Architecture) -- the relay architecture must be designed upfront.

**Confidence:** HIGH -- explicitly stated in official Azure OpenAI Realtime API documentation

---

### Pitfall 5: Avatar Real-Time Sessions Auto-Disconnect After 5 Minutes Idle / 30 Minutes Total

**What goes wrong:** During a training session, the MR pauses to review notes or think about a response. After 5 minutes of no audio input, the Avatar connection drops. Or a longer training scenario (realistic F2F call practice) exceeds 30 minutes and disconnects mid-session.

**Why it happens:** Azure Avatar real-time synthesis has hard-coded session limits: 5-minute idle timeout and 30-minute maximum connection. These are resource management limits on Microsoft's side.

**Consequences:**
- MR loses visual HCP presence mid-training
- Session state may be lost if not properly persisted
- Reconnection causes visible glitch (avatar re-initializes)

**Prevention:**
- Implement **auto-reconnect** as documented in Azure samples (search "auto reconnect" in the JS avatar sample)
- Send periodic keep-alive signals (silent audio or status pings) to prevent idle timeout
- Design training scenarios to have natural checkpoints within 25 minutes
- Persist conversation state server-side so avatar reconnection is seamless
- Show a "reconnecting..." UI state rather than an error

**Detection:** Test a scenario where the user is idle for 6 minutes. If the avatar freezes or disappears, you need the keep-alive.

**Affected phase:** Phase 3 (Avatar Integration) -- must implement reconnection logic.

**Confidence:** HIGH -- documented in official real-time avatar synthesis page

---

### Pitfall 6: Avatar Region Availability Is Extremely Limited

**What goes wrong:** The team deploys to a region for Azure OpenAI availability, then discovers Avatar is not available there. Avatar real-time synthesis is only available in **7 regions**: eastus2, northeurope, southcentralus, southeastasia, swedencentral, westeurope, westus2.

**Why it happens:** Avatar is a premium, compute-intensive service. Microsoft has not rolled it out broadly.

**Consequences:**
- Must use multi-region architecture: Avatar service in one region, OpenAI in another, backend in a third
- Cross-region latency adds up: if Avatar is in westeurope but OpenAI is in swedencentral and backend is in germanywestcentral, each hop adds 20-50ms
- For EU data residency, only westeurope, northeurope, and swedencentral support Avatar

**Prevention:**
- **Pick regions strategically**: for EU, use `westeurope` or `swedencentral` (both support Avatar + have good OpenAI model availability)
- For Asia-Pacific users (before China deployment), use `southeastasia` (Avatar + Speech + OpenAI all available)
- Document region decisions in infrastructure config and make them environment variables
- Consider deploying Avatar as a separate microservice that can be in a different region from the main backend

**Detection:** Try creating an Avatar resource in your target region. If it is not available, you hit this.

**Affected phase:** Phase 1 (Infrastructure Planning) -- region selection is a day-1 decision.

**Confidence:** HIGH -- verified via https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions

---

## Moderate Pitfalls

### Pitfall 7: Realtime API Endpoint Format Changed for GA

**What goes wrong:** Code uses the old preview endpoint format with `api-version` query parameter. The GA Realtime API requires a completely different endpoint format: `https://{resource}.openai.azure.com/openai/v1` -- no date-based API versions, no `api-version` query parameter.

**Prevention:**
- Use the GA endpoint format from the start
- Do NOT copy endpoint patterns from older Azure OpenAI REST API code
- Set `AZURE_OPENAI_ENDPOINT` as an environment variable, not hardcoded
- Test endpoint connectivity as the first integration step

**Affected phase:** Phase 2 (Voice Integration)

**Confidence:** HIGH -- documented in official Realtime API guide

---

### Pitfall 8: Audio Format Must Be PCM 24kHz

**What goes wrong:** Browser captures audio in a different format (e.g., Opus, AAC, or 16kHz PCM). Azure OpenAI Realtime API requires PCM at exactly 24,000 Hz sample rate. Format mismatch causes silent failures or garbled audio.

**Prevention:**
- Configure browser MediaRecorder / AudioContext to output PCM at 24kHz
- Use the Web Audio API `AudioContext` with explicit sample rate: `new AudioContext({ sampleRate: 24000 })`
- If the browser does not support 24kHz natively, resample on the server side before forwarding to Azure
- Test on mobile browsers (iOS Safari has historically been problematic with custom audio contexts)

**Detection:** If the HCP responds nonsensically or with "I didn't catch that," the audio format is likely wrong.

**Affected phase:** Phase 2 (Voice Integration)

**Confidence:** HIGH -- PCM 24kHz is explicitly documented

---

### Pitfall 9: Voice Activity Detection (VAD) Mode Selection Impacts UX

**What goes wrong:** Using `server_vad` (default) causes the AI to interrupt the MR mid-sentence because it detects a brief pause as end-of-speech. Alternatively, `semantic_vad` causes longer delays because it waits for semantic completion. Neither default works perfectly for medical terminology delivery practice.

**Why it happens:** MRs delivering product messages often pause to recall key messages or use technical terms with hesitation. Default VAD parameters (200ms silence = end of turn) are too aggressive for this use case.

**Prevention:**
- Start with `semantic_vad` for coaching scenarios (it understands utterance boundaries better than silence-based detection)
- If using `server_vad`, increase `silence_duration_ms` to 800-1200ms and adjust `threshold` to 0.7+
- Consider `none` (push-to-talk) mode for conference presentation scenarios where the MR is giving a prepared speech
- Make VAD mode configurable per scenario type (F2F vs. conference)
- Set `turn_detection.create_response` to `false` to add server-side moderation before generating a response

**Detection:** In user testing, if MRs complain about being interrupted or about long pauses before the HCP responds.

**Affected phase:** Phase 2 (Voice Integration), refined in Phase 5 (Polish)

**Confidence:** HIGH -- VAD modes documented in Realtime API

---

### Pitfall 10: Chinese Language TTS Has Fewer Voice Styles Than English

**What goes wrong:** The product design expects emotional HCP responses (frustrated doctor, skeptical specialist, friendly GP). Chinese TTS voices support only 8-12 styles compared to English's 16+. Some emotion styles (e.g., "angry," "fearful") may not be available for Chinese voices.

**Prevention:**
- Audit available voice styles for `zh-CN` voices before designing HCP personality configurations
- Use multilingual voices (e.g., `zh-CN-XiaoxiaoMultilingualNeural`) that support the broadest style range
- Compensate with text-level emotional expression (system prompts that make the LLM use emotional language) rather than relying solely on TTS prosody
- For Chinese HCPs, map personality types to available styles rather than designing personalities first and then trying to find matching voices

**Detection:** Create a test matrix of HCP personality -> voice style mapping. If any personality has no matching style, this is the issue.

**Affected phase:** Phase 3 (HCP Profile Configuration)

**Confidence:** HIGH -- verified via Azure Speech language support documentation

---

### Pitfall 11: i18n Retrofitting Is Extremely Costly

**What goes wrong:** The team builds the MVP in English, plans to "add Chinese later." Then discovers that i18n affects: database schemas (content in multiple languages), API response formats, frontend string management, TTS voice selection, scoring criteria language, prompt engineering (system prompts must be in the user's language for best results), and date/number formatting.

**Why it happens:** i18n feels like "just UI translation" but in an AI coaching platform it touches every layer of the stack.

**Consequences:**
- Backend prompts hardcoded in English produce worse Chinese responses
- Scoring rubrics in English cannot evaluate Chinese medical terminology usage
- Database stores content without language tags, making multi-language queries impossible
- Date formats (2026-03-24 vs. 2026年3月24日) cause display bugs

**Prevention:**
- The PROJECT.md correctly mandates "i18n from day 1" -- enforce this
- Use `react-i18next` or `next-intl` for frontend from the first component
- Store all user-facing content with a `locale` column in the database
- System prompts must be templated with language-specific versions
- Use ICU MessageFormat for pluralization rules (Chinese has no plural forms, European languages have complex rules)
- Store scoring criteria with locale-specific descriptions

**Detection:** Grep the codebase for hardcoded Chinese or English strings. If UI text is not in a translation file, flag it.

**Affected phase:** Phase 1 (Foundation) -- i18n framework must be set up before any UI is built.

**Confidence:** HIGH -- industry-standard knowledge, reinforced by PROJECT.md constraint

---

### Pitfall 12: WebRTC ICE Connectivity Fails Behind Corporate Firewalls

**What goes wrong:** MRs using the platform from BeiGene office networks cannot establish WebRTC connections to the Avatar service. Corporate firewalls block UDP traffic and TURN relay ports.

**Why it happens:** WebRTC relies on ICE (Interactive Connectivity Establishment) which tries direct peer connections first, then falls back to TURN relays. Corporate firewalls often block non-standard ports and UDP entirely.

**Consequences:**
- Avatar video does not load for office-based users
- Intermittent connectivity gives inconsistent experience
- IT departments may be reluctant to open firewall ports

**Prevention:**
- Always configure TURN server (not just STUN) using Azure Communication Services relay tokens
- Ensure TURN over TCP port 443 is available as fallback (most firewalls allow this)
- Test from behind a restrictive firewall during development
- Document firewall requirements for BeiGene IT: TCP 443 to `*.communication.microsoft.com`
- Provide a non-Avatar fallback for users who cannot establish WebRTC connections

**Detection:** If Avatar works on home WiFi but not on corporate network, this is the issue.

**Affected phase:** Phase 3 (Avatar Integration), Phase 6 (Deployment)

**Confidence:** MEDIUM -- standard WebRTC challenge, Azure-specific TURN endpoint needs verification

---

### Pitfall 13: Content Understanding Requires Separate Foundry Resource

**What goes wrong:** The team tries to use Azure Content Understanding for multimodal evaluation (analyzing MR presentation recordings) and discovers it requires a Microsoft Foundry resource, not a standard Cognitive Services resource. It also requires bringing your own model deployments for the generative capabilities.

**Prevention:**
- Provision a Microsoft Foundry resource (not just Speech or OpenAI resources)
- Deploy required models (GPT-4o or similar) within the Foundry resource for Content Understanding to use
- Content Understanding is GA with API version `2025-11-01` -- use the stable API
- Check region availability: Content Understanding is available in more regions than Avatar but still not universal

**Detection:** If Content Understanding API calls return "resource not found" or "model deployment required" errors.

**Affected phase:** Phase 4 (Scoring & Evaluation)

**Confidence:** MEDIUM -- verified overview but specific integration requirements need testing

---

### Pitfall 14: Realtime API One-Active-Conversation-Per-Session Limit

**What goes wrong:** The team attempts to manage multiple HCP conversations (e.g., conference mode with multiple virtual HCPs) through a single Realtime API session. The API only supports one active conversation per session.

**Prevention:**
- For conference mode (one-to-many), use one Realtime session per active HCP participant
- Alternatively, use standard completion API + separate TTS for conference mode (non-realtime is acceptable when HCPs are "audience members")
- Always check `response.metadata` to correlate responses with specific HCP contexts
- Design the session manager to track one-session-per-HCP mapping

**Detection:** If responses from different HCPs get mixed up or the second HCP never responds.

**Affected phase:** Phase 3 (Conference Mode)

**Confidence:** HIGH -- documented in Realtime API session constraints

---

## Minor Pitfalls

### Pitfall 15: Avatar Gestures Only Work in Batch Mode

**What goes wrong:** The team designs real-time HCP interactions with body language gestures (nodding, hand gestures). Avatar gestures are only available via the batch synthesis API, NOT the real-time API.

**Prevention:**
- Do not design real-time HCP interactions that depend on specific gestures
- Use background idle animation (built-in blinking and subtle movement) for real-time
- Reserve gesture-rich interactions for pre-recorded scenario intros (batch synthesis)

**Affected phase:** Phase 3 (Avatar Integration)

**Confidence:** HIGH -- explicitly documented in standard avatars page

---

### Pitfall 16: Entra ID Auth Not Supported for .NET Realtime SDK

**What goes wrong:** If the backend is ever ported to .NET, Entra ID authentication does not work with the Realtime API. Only API key authentication is supported for .NET. For JavaScript/Python, API keys need explicit header configuration due to SDK limitations.

**Prevention:**
- Since the project uses Python (FastAPI), verify Entra ID works with the Python OpenAI SDK for Realtime
- Always pass API keys via headers explicitly: `headers: {"api-key": token}`
- Store API keys in Azure Key Vault, never in code or environment files committed to git

**Affected phase:** Phase 2 (Voice Integration)

**Confidence:** HIGH -- documented in Realtime API how-to guide

---

### Pitfall 17: Azure China REST Endpoints Are Completely Different

**What goes wrong:** Configuration files use `.windows.net`, `.openai.azure.com`, or `cognitive.microsoft.com` domains. These do not resolve in Azure China. Every Azure service endpoint must be changed to `.chinacloudapi.cn` variants.

**Prevention:**
- Use environment-based configuration (already in project via pydantic-settings)
- Create per-environment `.env` files: `.env.global`, `.env.china`, `.env.eu`
- Map all service endpoints to environment variables, never hardcode domains
- Key endpoint differences:
  - Auth: `login.microsoftonline.com` -> `login.chinacloudapi.cn`
  - Storage: `*.blob.core.windows.net` -> `*.blob.core.chinacloudapi.cn`
  - AI Services: `api.cognitive.microsoft.com` -> `api.cognitive.azure.cn`
  - Speech: `*.tts.speech.microsoft.com` -> `*.tts.speech.azure.cn`
  - Portal: `portal.azure.com` -> `portal.azure.cn`

**Affected phase:** Phase 1 (Configuration), Phase 6 (China Deployment)

**Confidence:** HIGH -- verified via Azure China developer guide

---

### Pitfall 18: Browser Compatibility for Real-Time Avatar

**What goes wrong:** Users on Firefox cannot establish ICE connections with Azure Communication Services TURN servers. Some older mobile browsers do not support the required WebRTC features.

**Prevention:**
- Test on all target browsers: Chrome, Edge, Safari, Firefox
- Firefox requires Coturn (open-source TURN server) instead of Azure Communication Services ICE server
- Background transparency does not work on Android Firefox
- Provide browser compatibility check on the training session start page
- Recommend Chrome/Edge as primary browsers in user documentation

**Affected phase:** Phase 3 (Avatar Integration)

**Confidence:** HIGH -- documented in real-time avatar synthesis browser compatibility table

---

### Pitfall 19: EU Data Residency (GDPR) With Global Standard Deployments

**What goes wrong:** Azure OpenAI Global Standard deployments route traffic dynamically to any data center globally. This means EU user data (MR conversations, voice recordings) may be processed outside the EU, violating GDPR data residency requirements.

**Prevention:**
- Use **Data Zone Standard** deployments for EU regions (restricts processing to Microsoft-defined data zones)
- For EU deployment, choose `westeurope` or `swedencentral` as primary regions
- Alternatively, use **Standard** (regional) deployments that guarantee processing in the selected region
- Document data flow for compliance review: which data goes where, retention periods, deletion procedures
- Voice recordings subject to auto-deletion per configurable retention policies (FR-1.3)

**Detection:** Review deployment type in Azure portal. If it says "Global Standard" for EU-serving resources, flag for compliance review.

**Affected phase:** Phase 1 (Infrastructure), Phase 6 (EU Deployment)

**Confidence:** HIGH -- Global Standard vs Data Zone Standard distinctions verified in quotas documentation

---

### Pitfall 20: Realtime API Preview Models May Upgrade Without Notice

**What goes wrong:** The team builds and tests against `gpt-4o-realtime-preview` (2024-12-17). Microsoft upgrades the model version without notice because preview models don't follow standard lifecycle policies. Behavior changes break scoring consistency or conversation quality.

**Prevention:**
- Use GA models for production: `gpt-realtime` (2025-08-28) or `gpt-realtime-1.5` (2026-02-23)
- Pin model versions explicitly in deployment configuration
- Implement regression tests that check conversation quality metrics against known scenarios
- Monitor Azure OpenAI announcements and model deprecation notices

**Affected phase:** Phase 2 (Voice Integration), ongoing maintenance

**Confidence:** HIGH -- documented in Azure OpenAI model lifecycle documentation

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Architecture & Foundation | China has no Avatar, likely no Azure OpenAI | Design provider-agnostic adapters, two-tier visual system (Pitfalls 1, 2) |
| Infrastructure Setup | Region mismatch (Avatar vs OpenAI vs Speech) | Pick regions where all 3 services overlap: westeurope, swedencentral, southeastasia (Pitfall 6) |
| Voice Integration | Realtime API quotas, audio format, endpoint format | Use GA models, PCM 24kHz, new endpoint format (Pitfalls 3, 7, 8) |
| Voice Integration | VAD mode causes interruptions during medical term delivery | Use semantic_vad, increase silence thresholds (Pitfall 9) |
| Avatar Integration | Session timeouts, gesture limitations, browser compat | Auto-reconnect, batch-only gestures, test Firefox (Pitfalls 5, 15, 18) |
| Avatar Integration | Corporate firewall blocks WebRTC | TURN over TCP 443, document firewall requirements (Pitfall 12) |
| HCP Configuration | Chinese voice styles limited | Map personalities to available styles first (Pitfall 10) |
| i18n Implementation | Retrofitting is multi-layer work | i18n framework from component #1 (Pitfall 11) |
| Scoring & Evaluation | Content Understanding needs Foundry resource + model deployments | Provision correct resource type early (Pitfall 13) |
| Conference Mode | One conversation per Realtime session | Separate sessions per HCP or use standard API (Pitfall 14) |
| China Deployment | All service endpoints different, many services unavailable | Environment-based config, alternative AI providers (Pitfalls 2, 17) |
| EU Deployment | GDPR with Global Standard deployments | Use Data Zone Standard or regional deployments (Pitfall 19) |
| Production Hardening | Preview model behavior changes | Use GA models, pin versions, regression tests (Pitfall 20) |

---

## Sources

All findings verified against official Microsoft documentation (accessed 2026-03-24):

- [Azure OpenAI Realtime API - How To](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio) -- HIGH confidence
- [Azure OpenAI Quotas and Limits](https://learn.microsoft.com/en-us/azure/ai-services/openai/quotas-limits) -- HIGH confidence (updated 2026-03-21)
- [Azure Speech Service Regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions) -- HIGH confidence (updated 2026-03-17)
- [Azure Speech Sovereign Clouds](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/sovereign-clouds) -- HIGH confidence (updated 2026-02-28)
- [Azure TTS Avatar Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar) -- HIGH confidence
- [Azure TTS Avatar Real-Time Synthesis](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/real-time-synthesis-avatar) -- HIGH confidence (updated 2026-03-03)
- [Azure TTS Avatar Standard Avatars](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars) -- HIGH confidence
- [Azure OpenAI Models](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models) -- HIGH confidence
- [Azure China Developer Guide](https://learn.microsoft.com/en-us/azure/china/resources-developer-guide) -- HIGH confidence
- [Azure China Service Availability](https://learn.microsoft.com/en-us/azure/china/concepts-service-availability) -- HIGH confidence
- [Azure Content Understanding Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview) -- HIGH confidence (updated 2026-03-13)
- [Azure Speech Language Support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) -- HIGH confidence
