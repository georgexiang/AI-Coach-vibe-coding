# AI Coach Solution — Requirements Specification

> Extracted from Capgemini AI Coach for AWS solution document

---

## FR: Functional Requirements

### FR-1: Training Material Management

| ID | Requirement | Priority |
|----|------------|----------|
| FR-1.1 | Centralized document management supporting Word/Excel/PDF/content uploads | High |
| FR-1.2 | Version control and archiving of training materials | High |
| FR-1.3 | Automatic deletion of voice records per configurable retention policies | Medium |
| FR-1.4 | Historical data archiving for departed employees | Medium |

### FR-2: F2F HCP Engagement (One-on-One)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-2.1 | Handle F2F calls with objection handling simulation | High |
| FR-2.2 | Provide scenario and digital HCP background visibility for MR before interaction | High |
| FR-2.3 | Accept audio input from MR (voice-based interaction via ASR) | High |
| FR-2.4 | Accept text input from MR (text-based interaction) | High |
| FR-2.5 | Generate corresponding audio/text outputs from Digital HCP | High |
| FR-2.6 | Allow history conversation review (past session playback) | Medium |
| FR-2.7 | Provide scores and feedback based on configurable score criteria | High |
| FR-2.8 | Offer a customizable rating criteria and feedback system | High |

### FR-3: Virtual Department Conference Presentation (One-to-Many)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-3.1 | Support content presentations with product/disease knowledge | High |
| FR-3.2 | Support audience question answering from virtual HCPs | High |
| FR-3.3 | Provide presentation multi-scenario visibility for MR | Medium |
| FR-3.4 | Accept audio input with live translated text on screen (real-time transcription) | High |
| FR-3.5 | Generate typical objections based on historical data | Medium |
| FR-3.6 | Provide verbal suggestions for handling objections | Medium |
| FR-3.7 | Offer customizable rating criteria and feedback | High |

### FR-4: Multi-dimensional Scoring System

| ID | Requirement | Priority |
|----|------------|----------|
| FR-4.1 | Multidimensional scoring evaluating key competencies | High |
| FR-4.2 | Real-time suggestions during training sessions | High |
| FR-4.3 | Post-session reports highlighting strengths | High |
| FR-4.4 | Post-session reports highlighting weaknesses | High |
| FR-4.5 | Post-session reports with targeted improvement areas | High |
| FR-4.6 | Scoring across: key message delivery, objection handling, communication, product knowledge, scientific information | High |

### FR-5: Report and Dashboard

| ID | Requirement | Priority |
|----|------------|----------|
| FR-5.1 | Generate standard reports with sorting/filtering by BU, role, and time period | High |
| FR-5.2 | Provide personal-level analysis of training results | High |
| FR-5.3 | Provide group-level analysis of training results | High |
| FR-5.4 | Enable export of results in PDF format | Medium |
| FR-5.5 | Enable export of results in Excel format | Medium |
| FR-5.6 | Track training progress/completion status across organization | High |

### FR-6: Digital HCP Configuration

| ID | Requirement | Priority |
|----|------------|----------|
| FR-6.1 | Set the virtual HCP's portrait/visual appearance | Medium |
| FR-6.2 | Set the HCP's knowledge background and medical perspective | High |
| FR-6.3 | Set scoring criteria per scenario | High |
| FR-6.4 | Configure diverse personality settings for virtual HCPs | Medium |
| FR-6.5 | Configure HCP profiles with different emotional states, contexts, and intentions | Medium |
| FR-6.6 | Support multi-product training scenarios | High |

### FR-7: AI & NLP Capabilities

| ID | Requirement | Priority |
|----|------------|----------|
| FR-7.1 | Human-like emotional depth for conversations (text analytics powered) | High |
| FR-7.2 | Voice Processing / ASR (Automatic Speech Recognition) | High |
| FR-7.3 | NLP for analyzing complex expressions: Emotion, Context, Intention | High |
| FR-7.4 | Dynamic course optimization leveraging AI capability | Medium |
| FR-7.5 | Personalized training paths based on MR's role/BU | High |

---

## NFR: Non-Functional Requirements

| ID | Requirement | Category | Priority |
|----|------------|----------|----------|
| NFR-1 | Audit-ready competency tracking (fully traceable training paths) | Compliance | High |
| NFR-2 | Scalable to support organization-wide deployment | Scalability | High |
| NFR-3 | Configurable scenarios for specific therapeutic areas, product launches, or regional norms | Extensibility | Medium |
| NFR-4 | Adaptable to emerging market trends or regulatory changes | Maintainability | Medium |
| NFR-5 | Data retention policy compliance (automatic deletion of voice records) | Data Privacy | High |
| NFR-6 | Historical data archiving for departed employees | Data Management | Medium |
| NFR-7 | AWS cloud deployment | Infrastructure | High |

---

## BV: Business Value Requirements

| ID | Business Value | Metric |
|----|---------------|--------|
| BV-1 | Accelerate Training Efficiency | Cut time-to-competency |
| BV-2 | Significant Cost Optimization | Reduce L&D OPEX |
| BV-3 | Enhanced Sales Effectiveness | Boost call success rates and product uptake |
| BV-4 | Data-Driven Performance Optimization | Identify skill gaps via aggregated analytics |
| BV-5 | Competitive Differentiation | Adaptable to market trends/regulatory changes |
| BV-6 | Enhance Professional Capability | Better objection handling and communication skills |

---

## UI/UX Requirements Summary

> UI prototype screenshots are preserved in `pdf/images/ui-*` for design reference.

| Screen | File | Key Features |
|--------|------|-------------|
| HCP Coach Demo | `ui-hcp-coach-demo.png` | Scenario selection, chat interface, audio/text toggle, conversation history |
| Scoring System | `ui-scoring-system.png` | Score dashboard, dimension breakdown, detailed feedback panels |
| Virtual Doctor Config | `ui-reference-virtual-doctor.png` | Portrait setup, knowledge config, scoring criteria setup |
| Virtual HCP Reference | `ui-reference-virtual-hcp.png` | Full interaction flow, scenario selection, scoring, chat |

### UI Design Patterns Observed

1. **Mobile-first design** — UI mockups are primarily mobile/tablet oriented (WeChat Mini Program style)
2. **Chat-based interaction** — Primary interaction via chat bubbles with avatar
3. **Audio/Text dual mode** — Toggle between voice and text input
4. **Card-based scenario selection** — Scenarios presented as cards with HCP profile info
5. **Dashboard scoring view** — Radar/dimension charts for multi-dimensional scoring
6. **Detailed feedback panels** — Expandable sections for per-dimension feedback with specific suggestions
7. **Blue/white color scheme** — Professional medical training aesthetic

---

## Glossary

| Term | Definition |
|------|-----------|
| **MR** | Medical Representative |
| **HCP** | Healthcare Professional |
| **F2F** | Face-to-Face |
| **BU** | Business Unit |
| **ASR** | Automatic Speech Recognition |
| **NLP** | Natural Language Processing |
| **DM** | District Manager |
| **L&D** | Learning & Development |
| **OPEX** | Operational Expenditure |
| **MSL** | Medical Science Liaison |
