# Pre-Demo Smoke Test Checklist

> Use this checklist before each BeiGene customer demo to verify all Azure services and demo flow are operational.
> Last updated: 2026-03-28

## Prerequisites

- [ ] Backend running: `cd backend && uvicorn app.main:app --port 8000`
- [ ] Frontend running: `cd frontend && npm run dev`
- [ ] Azure credentials configured (see Section 1 below)
- [ ] Demo user accounts exist: admin/admin123, user/user123
- [ ] Test microphone available (for voice/avatar modes)
- [ ] Using Chrome or Edge browser (WebRTC support required for avatar)

## 1. Azure Service Health

### AI Foundry Configuration

- [ ] Login as admin (admin/admin123)
- [ ] Navigate to Admin > Azure Config
- [ ] AI Foundry card shows endpoint URL: `https://ai-foundary-qiah-east-us2.cognitiveservices.azure.com/`
- [ ] AI Foundry card shows region: `eastus2`
- [ ] AI Foundry card shows API key hint (****xxxx)

### Per-Service Connection Tests

- [ ] Azure OpenAI: Click "Test Connection" -> green success toast within 15s
- [ ] Azure Speech STT: Click "Test Connection" -> green success toast
- [ ] Azure Speech TTS: Click "Test Connection" -> green success toast
- [ ] Azure Voice Live: Click "Test Connection" -> green success toast (region must be eastus2 or swedencentral)
- [ ] Azure AI Avatar: Click "Test Connection" -> green success toast
- [ ] Azure Content Understanding: Click "Test Connection" -> green success toast
- [ ] "Test All Services" button: all configured services return success

## 2. Text Mode Demo

- [ ] Login as user (user/user123)
- [ ] Navigate to Training > select any scenario
- [ ] Mode selector shows "Text" as active
- [ ] Click "Start Session"
- [ ] Chat area loads with empty message list
- [ ] Type: "Hello doctor, I would like to discuss the treatment options" and send
- [ ] AI responds within 3 seconds (D-17)
- [ ] AI response is in character (not mock "Lorem ipsum" text)
- [ ] Send 2 more messages -- conversation flows naturally
- [ ] Key message checklist in hints panel updates during conversation
- [ ] Click "End Session"
- [ ] Scoring report renders with:
  - [ ] Overall score (numeric value)
  - [ ] Per-dimension scores (radar chart or cards)
  - [ ] Strengths section (green highlights)
  - [ ] Weaknesses section (orange highlights)
  - [ ] Improvement suggestions (purple highlights)
  - [ ] Conversation quotes from the session

## 3. Voice Mode Demo

- [ ] Select scenario, choose "Voice" communication type
- [ ] Select "Realtime" engine (two-level selector)
- [ ] Click "Start Session"
- [ ] Connection status transitions: "Connecting..." -> "Connected" (green dot)
- [ ] Microphone button appears and is interactive
- [ ] Speak: "Hello, I am a medical representative from BeiGene"
- [ ] Transcript area shows real-time transcription of your speech
- [ ] AI responds with synthesized speech (audible)
- [ ] AI response transcript appears in transcript area
- [ ] Response latency feels conversational (< 3 seconds) (D-17)
- [ ] Click "End Session"
- [ ] Scoring report renders with same quality as text mode (D-19)

## 4. Avatar Mode Demo

- [ ] Select scenario, choose "Digital Human" communication type
- [ ] Select "Realtime" engine
- [ ] Click "Start Session"
- [ ] Avatar video area renders (WebRTC connection establishes)
- [ ] Avatar character appears (no freeze, no black screen)
- [ ] Speak into microphone
- [ ] Avatar lip-sync matches speech output (D-18)
- [ ] Avatar gestures/expressions look natural
- [ ] No video freezing or audio desync during conversation
- [ ] Click "End Session"
- [ ] Scoring report renders correctly (D-19)

## 5. Fallback Chain (D-13)

### Avatar -> Voice Fallback

- [ ] Admin: disable Avatar service (toggle off)
- [ ] User: select Digital Human mode, start session
- [ ] System shows fallback toast: "Avatar unavailable, switching to voice-only"
- [ ] Session continues in voice-only mode with waveform visualization

### Voice -> Text Fallback

- [ ] Admin: disable Voice Live service (toggle off)
- [ ] User: attempt voice mode
- [ ] System shows fallback toast: "Voice unavailable, switching to text mode"
- [ ] Session continues in text-only mode with ChatInput

## 6. Mode Selector Verification

- [ ] Text mode always visible and enabled
- [ ] Voice mode visible only when Voice Live is enabled
- [ ] Digital Human mode visible only when Avatar is enabled
- [ ] Pipeline engine visible when STT+TTS are enabled
- [ ] Realtime engine visible when Voice Live is enabled
- [ ] Agent engine visible when agent mode is configured
- [ ] Disabled modes show tooltip explaining why disabled

## 7. Scoring Parity (D-19)

Compare scoring reports across session modes:

- [ ] Text session scoring: dimensions shown, quotes present, suggestions meaningful
- [ ] Voice session scoring: same dimension count, same quality level
- [ ] Avatar session scoring: same dimension count, same quality level
- [ ] All three modes produce comparable score ranges for similar conversations

## 8. Performance Checklist (D-17, D-18)

- [ ] Text: AI first response < 3 seconds
- [ ] Voice: First transcription appears < 2 seconds after speaking
- [ ] Voice: AI spoken response starts < 3 seconds after user finishes
- [ ] Avatar: Video renders within 10 seconds of session start
- [ ] Avatar: No visible freezing during 5-minute conversation
- [ ] Page transitions: < 1 second between pages

## Quick Recovery Steps

| Problem | Recovery |
|---------|----------|
| "Connection test failed" | Check AI Foundry endpoint URL and API key. Verify Azure portal shows resource is active. |
| Avatar shows black screen | Refresh browser. Check WebRTC is not blocked by firewall/VPN. Try Chrome incognito. |
| Voice "Connecting..." stuck | Check region is eastus2 or swedencentral. Check microphone permissions in browser. |
| Scoring report empty | Check Azure OpenAI connection. Mock adapter does not produce real scoring. |
| "Mock HCP Response" text | Azure OpenAI not configured or connection failed. Check admin config page. |
| Audio echo/feedback | Use headphones or ensure echo cancellation is enabled in browser settings. |
| Session creation fails | Verify backend is running and database is initialized. Check `uvicorn` logs for errors. |
| Page shows 404 | Verify frontend dev server is running. Check that routes match current version. |

## Automated E2E Test

Run the Playwright demo-flow E2E test for quick validation:

```bash
cd frontend
npx playwright test e2e/demo-flow.spec.ts --config=e2e/playwright.config.ts
```

This test covers admin config, text session, mode selector, and scoring report. It works
against the mock backend without Azure credentials.

---
*Checklist version: 1.0*
*Last verified: 2026-03-28*
