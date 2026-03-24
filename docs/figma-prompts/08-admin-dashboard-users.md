# Figma Prompt: Admin Dashboard + User Management

Design two admin pages for AI Coach platform. Desktop 1440x900, Admin Layout with left sidebar.

## Page 1: Admin Dashboard

### Stats Row (4 cards):
- "Total MRs": 156, people icon
- "Avg Score": 74, chart icon, trend +3%
- "Active Now": 12, green dot, pulse animation hint
- "Completion Rate": 82%, circular progress

### Main Grid (2 columns):

**Left (60%): Score Distribution**
- Histogram chart: X-axis score ranges (0-20, 20-40, 40-60, 60-80, 80-100), Y-axis count
- Color gradient: red to green
- Title: "Organization Score Distribution"

**Right (40%): Alerts**
- "Top Performers" list (top 5): avatar + name + score (green)
- "Needs Attention" list (bottom 5): avatar + name + score (red) + "Last active: 7 days ago"

### Bottom Row:
- Training Activity Heatmap: calendar-style grid (last 12 weeks), color intensity = session count
- Filter: BU dropdown, Region dropdown

---

## Page 2: User Management

### Top:
- Title: "User Management"
- "Add User" blue button (right), "Import CSV" outline button
- Search input, Filter: Role dropdown (All/MR/DM/Admin), BU dropdown, Status (Active/Inactive)

### Table:
Columns: Checkbox, Name (with avatar), Email, Role (badge), BU, Region, Last Active, Status (green/gray dot), Actions (edit/deactivate icons)

Show 8 rows with varied data. Example:
- Zhang Wei, zhang@beigene.com, MR, Oncology BU, North China, 2h ago, Active
- Li Ming, li@beigene.com, DM, Hematology BU, East China, 1d ago, Active
- Admin User, admin@beigene.com, Admin, -, Global, now, Active

Bottom: Pagination + "Showing 1-8 of 156 users"
