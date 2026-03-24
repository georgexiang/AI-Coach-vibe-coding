# Figma Prompt: User Dashboard

Design the MR (Medical Representative) dashboard home page for an AI Coach training platform. Desktop 1440x900, inside the User Layout Shell (top nav).

## Content Layout (2-row grid):

### Row 1: Stats Cards (4 cards, equal width, horizontal)
- "Sessions Completed" — large number (e.g., 24), small label, green up arrow +3 this week
- "Average Score" — large number (e.g., 78), mini radar chart icon, blue
- "This Week" — number (e.g., 5), calendar icon, progress bar showing 5/7 goal
- "Improvement" — percentage (e.g., +12%), trend line mini chart, green

### Row 2: Two columns

**Left column (60% width): Recent Sessions**
- Section title: "Recent Training Sessions"
- List of 5 items, each row showing:
  - HCP avatar (small circle) + HCP name + specialty
  - Mode badge: "F2F" (blue) or "Conference" (purple)
  - Score: number with color (green >80, orange 60-80, red <60)
  - Date: relative (e.g., "2 hours ago")
  - Arrow to view details
- "View All" link at bottom

**Right column (40% width): Quick Actions**
- Section title: "Start Training"
- Two large action cards stacked:
  - "F2F HCP Training" — blue gradient, chat icon, "Practice 1-on-1 with digital HCP", Start button
  - "Conference Training" — purple gradient, presentation icon, "Practice department presentation", Start button
- Below: "Recommended Scenario" card — showing next suggested scenario with HCP name and difficulty

## Style: Clean white cards on light gray bg, consistent 24px gaps, rounded-lg corners
