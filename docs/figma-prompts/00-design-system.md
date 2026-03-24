# Figma Prompt: Design System

Create a design system for an enterprise medical training SaaS platform (AI Coach for pharma MR training).

## Style
- Professional medical/pharma aesthetic, clean and trustworthy
- Primary: Blue (#1E40AF) + White, Secondary: Slate gray (#475569)
- Accent colors for scoring: Green (strength), Orange (weakness), Purple (improvement)
- Font: Inter (EN) + Noto Sans SC (CN), support i18n
- Border radius: 8px cards, 6px buttons, 4px inputs
- Shadows: subtle (0 1px 3px rgba(0,0,0,0.1))

## Components to create:

**Navigation:**
- TopNav: logo, nav links, language switcher (CN/EN), user avatar dropdown
- AdminSidebar: collapsible left sidebar with icon+text menu items
- Breadcrumb

**Cards:**
- ScoreCard: large number + label + trend arrow (up green/down red) + mini sparkline
- HCPProfileCard: avatar circle + name + specialty + hospital + personality tags + difficulty badge
- ServiceConfigCard: service icon + name + status indicator (green/red dot) + expandable form

**Data Display:**
- RadarChart placeholder: 5-axis radar for scoring dimensions
- DimensionBar: horizontal bar with score label + color fill + percentage
- DataTable: header row + data rows + sort arrows + pagination footer
- StatusBadge: pill shape, variants: Active(green), Draft(gray), Error(red), Pending(yellow)

**Form Elements:**
- FormField: label + input/select/slider + validation message
- LanguageSwitcher: dropdown with flag icons (🇨🇳 CN / 🇬🇧 EN)
- AudioControls: mic button (idle/recording/processing states) + waveform bar

**Chat:**
- ChatBubble: two variants — Left (HCP, blue bg) with avatar, Right (MR, gray bg)
- ChatInput: text field + mic button + send button, full width

**Feedback:**
- EmptyState: illustration + message + action button
- LoadingState: skeleton rectangles
