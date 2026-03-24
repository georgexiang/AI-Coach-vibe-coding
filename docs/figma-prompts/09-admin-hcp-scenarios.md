# Figma Prompt: HCP Configuration + Scenario Management

Design two admin pages for AI Coach platform. Desktop 1440x900, Admin Layout with left sidebar.

## Page 1: HCP Profile Configuration

### Left: HCP List (300px sidebar)
- Search input at top
- List of HCP profiles: avatar + name + specialty
- Active item highlighted in blue
- "Create New HCP" button at bottom

### Right: HCP Editor Form (main area)
- **Portrait Section**: Large avatar circle (120px) with "Upload" overlay button
- **Identity Fields**:
  - Name input, Specialty dropdown, Hospital input, Title input
- **Personality Settings** (card):
  - Personality Type: dropdown (Skeptical, Friendly, Busy, Detail-oriented, Resistant)
  - Emotional State: slider (Neutral ←→ Resistant)
  - Communication Style: slider (Direct ←→ Indirect)
- **Knowledge Background** (card):
  - Medical Expertise: multi-select tag input (Oncology, Immunotherapy, Clinical Trials...)
  - Prescribing Habits: textarea
  - Concerns & Perspectives: textarea
- **Interaction Rules** (card):
  - Typical Objections: editable list with add/remove (e.g., "Side effects are too severe")
  - Key Topics to Probe: editable list
  - Difficulty: radio buttons (Easy/Medium/Hard)
- Bottom: "Save" primary button, "Test Chat" outline button, "Cancel" text button

---

## Page 2: Scenario Management

### Top: Title + "Create Scenario" button + filter (Status: All/Active/Draft)

### Table:
Columns: Name, Product, HCP, Mode (F2F/Conference badge), Difficulty, Status (Active green/Draft gray), Actions

### Expanded: Scenario Editor (modal or inline)
- Name, Description textarea
- Product/Therapeutic Area dropdown
- Assigned HCP: select from configured HCPs (shows avatar + name)
- Mode: F2F / Conference / Both (radio)
- Key Messages: editable checklist (add/remove items)
- Scoring Weights: 5 sliders (Key Message, Objection, Communication, Product, Scientific) totaling 100%
- Pass Threshold: number input (default 70)
- "Save" and "Clone Scenario" buttons
