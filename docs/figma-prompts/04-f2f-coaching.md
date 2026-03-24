# Figma Prompt: F2F HCP Coaching

Design the core F2F training page — 1-on-1 conversation between MR and digital HCP. Desktop 1440x900. This is the most important page.

## 3-Column Layout:

### Left Panel (280px, collapsible):
- Section: "Scenario Briefing" card
  - Product: "PD-1 Inhibitor"
  - Context: brief text about the visit scenario
- Section: "HCP Profile" card
  - Avatar (60px), Name: Dr. Wang Wei
  - Specialty: Oncologist
  - Personality: "Skeptical, Detail-oriented"
  - Background: "Prefers evidence-based data, concerned about side effects"
- Section: "Key Messages" checklist
  - ☐ Efficacy data from Phase III trial
  - ☐ Safety profile comparison
  - ☐ Dosing convenience
  - ☐ Patient quality of life data
- Section: "Scoring Criteria" mini preview
  - Key Message: 30%, Objection Handling: 25%, Communication: 20%, Product Knowledge: 15%, Scientific: 10%

### Center Panel (main, flexible width):
- Top bar: Session timer (12:34), "End Session" red button (top right)
- Avatar display area (240px height): HCP avatar placeholder with "Azure AI Avatar" label, toggle to enable/disable
- Chat area (scrollable):
  - HCP bubble (left, blue bg): "Good morning, I have about 10 minutes. What brings you here today?"
  - MR bubble (right, gray bg): "Dr. Wang, thank you for your time. I'd like to share some exciting new data..."
  - HCP bubble: "I've seen many claims about PD-1 inhibitors. What makes yours different?"
  - Typing indicator at bottom
- Input area (bottom, fixed):
  - Text input field (expandable)
  - Mic button (circle, blue) with states: idle / recording (red pulse) / processing
  - Audio/Text mode toggle switch
  - Send button (arrow icon)

### Right Panel (260px, collapsible):
- Section: "AI Coach Hints" (yellow bg card)
  - "Consider mentioning the Phase III overall survival data"
  - "Dr. Wang values specific numbers — use statistics"
- Section: "Message Tracker"
  - ✓ Efficacy data (delivered, green check)
  - ◆ Safety profile (in progress, blue dot)
  - ○ Dosing convenience (pending, gray)
  - ○ Quality of life (pending, gray)
- Section: Timer + word count stats
