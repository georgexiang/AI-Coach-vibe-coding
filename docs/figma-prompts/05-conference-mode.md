# Figma Prompt: Conference Presentation Mode

Design the 1-to-many conference training page. MR presents to virtual HCP audience. Desktop 1440x900.

## Layout:

### Main Area (center, 70% width):
- **Presentation area** (top, 60% height):
  - Large content display area showing a presentation slide
  - Slide content: "PD-1 Inhibitor — Phase III Clinical Results" with a chart placeholder
  - Bottom controls: Previous / Next slide buttons, slide counter "3/12"
- **Live transcription bar** (below slides, 40px):
  - Scrolling text showing real-time MR speech transcription
  - Mic status indicator (green = active)
- **Virtual audience strip** (bottom, 120px):
  - Row of 5 HCP avatar circles with names below:
    - Dr. Wang (Oncology), Dr. Li (Cardiology), Dr. Zhang (Neurology), Dr. Chen (Pulmonology), Dr. Liu (Endocrinology)
  - Active speaker highlighted with blue ring
  - "Hand raised" indicator on some avatars (yellow hand icon)

### Right Panel (30% width):
- **Audience Questions** section (top half):
  - Queue of questions from virtual HCPs:
    - Dr. Wang: "What about the comparison with pembrolizumab?"
    - Dr. Zhang: "Any data on CNS metastases?"
  - Each question has "Answer" button
- **Objection Hints** section (bottom half):
  - AI-generated suggested responses:
    - "Our head-to-head trial showed non-inferior OS with better safety..."
    - "CNS data from the subgroup analysis shows..."
  - Yellow hint cards, expandable

### Top Bar:
- Session info: "Conference Training — Oncology Department Meeting"
- Timer: 15:23
- Audience count: "5 HCPs"
- "End Presentation" red button

### Bottom Controls:
- Large mic button (center), Mute/Unmute
- Audio waveform indicator when speaking
