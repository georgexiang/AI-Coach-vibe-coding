# Figma Prompt: Azure Service Config + System Settings

Design two admin pages for AI Coach platform. Desktop 1440x900, Admin Layout with left sidebar.

## Page 1: Azure Service Configuration

### Top: Title "Azure Services" + "Test All Connections" button (right)

### Service Cards (stacked, each expandable):

**Card 1: Azure OpenAI**
- Header: Cloud icon + "Azure OpenAI" + status dot (green = connected)
- Expanded form:
  - Endpoint URL input
  - API Key input (masked ******, show/hide toggle)
  - Deployment Name input
  - Model: dropdown (GPT-4o, GPT-4o-mini)
  - Temperature: slider 0-1
  - "Test Connection" button → shows ✓ Connected or ✗ Failed

**Card 2: Azure OpenAI Realtime**
- Endpoint, API Key, Deployment Name, WebSocket endpoint
- Test Connection button

**Card 3: Azure Speech Services**
- Region dropdown, Subscription Key (masked)
- STT Language: multi-select (zh-CN, en-US, de-DE, fr-FR)
- TTS Voice: dropdown with "Preview" play button
- Test Connection button

**Card 4: Azure AI Avatar**
- Endpoint, API Key
- Avatar Style: thumbnail grid selector (3 avatar options)
- Video Quality: Low/Medium/High radio
- Test Connection button

**Card 5: Azure Content Understanding**
- Endpoint, API Key
- Features toggle: Document Analysis ☑, Image Analysis ☑, Video Analysis ☐
- Test Connection button

**Card 6: Database**
- Connection String (masked), Pool Size input
- Health: "Healthy" green badge or "Error" red badge

---

## Page 2: System Settings

Tabbed layout: Language | Data Retention | Branding

**Language Tab:**
- Default Language: dropdown (Chinese/English)
- Available Languages: toggle list (Chinese ☑, English ☑, German ☐, French ☐, Japanese ☐)

**Data Retention Tab:**
- Voice Records: number input + "days" (default 90)
- Session Data: number input + "days" (default 365)
- Auto-archive toggle

**Branding Tab:**
- Logo upload area
- Platform Name input
- Primary Color picker
