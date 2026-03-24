# Figma Prompt: Session History + Personal Reports

Design two pages for AI Coach platform. Desktop 1440x900.

## Page 1: Session History

### Top:
- Page title: "Training History"
- Filter bar: Date range picker, Mode dropdown (All/F2F/Conference), Score range slider, Product dropdown
- Search input for scenario name

### Main: Data Table
Columns:
- Date (sortable): "Mar 24, 2026 10:30"
- Scenario: HCP name + specialty (with small avatar)
- Mode: badge "F2F" (blue) or "Conference" (purple)
- Score: number with color (78 in orange, 85 in green)
- Dimensions: 5 mini bars showing each dimension score
- Duration: "15 min"
- Actions: "View" link, "Replay" link

Show 8 rows of sample data with varied scores and modes.
Bottom: Pagination "Showing 1-8 of 24 sessions" with page numbers.

---

## Page 2: Personal Reports

### Top:
- Page title: "My Performance Report"
- Time period tabs: Week | Month | Quarter | Year (Month active)

### Layout (2x2 grid):

**Top-left: Score Trend**
- Line chart showing overall score over time (last 30 days)
- Y-axis: 0-100, X-axis: dates
- Line with data points, upward trend

**Top-right: Dimension Comparison**
- Radar chart: This month (blue solid) vs Last month (gray dashed)
- 5 dimensions labeled

**Bottom-left: Training Frequency**
- Bar chart: sessions per week over last 4 weeks
- Color: blue bars

**Bottom-right: Focus Areas**
- Card with:
  - "Top Strength": Communication Skills (85%) — green
  - "Needs Work": Scientific Information (68%) — orange
  - "Recommended": "Focus on evidence-based responses in next 3 sessions"

### Bottom: Export buttons — "Download PDF Report" | "Download Excel Data"
