# Figma Prompt: Training Materials + Org Reports

Design two admin pages for AI Coach platform. Desktop 1440x900, Admin Layout.

## Page 1: Training Material Management

### Layout: Two panels

**Left Panel (300px): Folder Tree**
- Root: "Training Materials"
  - By Product
    - PD-1 Inhibitor
    - BTK Inhibitor
  - By Therapeutic Area
    - Oncology
    - Hematology
- Active folder highlighted

**Right Panel: File List**
- Top: Folder name + "Upload Files" button (blue) + drag-drop zone (dashed border)
- Table columns: File icon + Name, Type (PDF/Word/Excel badge), Size, Uploaded Date, Uploaded By, Version, Actions (preview/download/delete)
- Show 6 sample files:
  - "PD-1 Phase III Results.pdf" — PDF — 2.4MB — Mar 20 — Admin — v3
  - "Safety Profile Summary.docx" — Word — 580KB — Mar 18 — Admin — v2
  - etc.
- Click row to expand: Version history list (v1, v2, v3 with dates)

### Bottom:
- Retention Policy banner: "Voice records auto-delete after 90 days" info message

---

## Page 2: Organization Reports

### Top:
- Title: "Organization Analytics"
- Filters: BU dropdown, Region dropdown, Product dropdown, Date range picker

### Grid Layout (2x2):

**Top-left: Group Performance**
- Grouped bar chart: BU comparison (Oncology, Hematology, Immunology)
- Each group shows avg score as bar, color by performance

**Top-right: Score Trends**
- Multi-line chart: organization avg over time (12 weeks)
- Benchmark line at 75 (dashed)

**Bottom-left: Completion Rates**
- Horizontal bar chart by region
- North China: 85%, East China: 72%, South China: 68%, West China: 91%

**Bottom-right: Skill Gap Analysis**
- Stacked bar or heat table showing org-wide dimension scores
- Rows: 5 dimensions, Columns: BUs
- Color: green (strong) to red (weak)

### Bottom: "Export PDF Report" + "Export Excel Data" buttons
