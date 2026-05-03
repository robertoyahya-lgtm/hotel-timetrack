# Drivcoh Design System — Taste Skill

Use `/design` before any visual work to load these principles into context.

## Identity
Drivcoh Employees is a **premium hospitality SaaS / PMS** for boutique Montreal hotels.
Target feel: **Linear × Stripe × Mews** — dark sidebar, clean content, data-dense but refined.

## Color Tokens (v2)
- Sidebar bg: `#0c1a2e` (deep navy)
- Sidebar accent: `#60a5fa` (sky blue — pops on dark)
- Page bg: `#f9fafb` (clean, neutral)
- Cards: white + `#eaecf0` border
- Primary action: `#1a4f8a` navy → `#123c6d` hover
- Success: `#027a48` emerald
- Warning: `#b54708` amber
- Danger: `#b42318` red
- Text primary: `#101828`
- Text muted: `#667085`
- Text subtle: `#98a2b3`

## Typography Rules
- **Base font**: Inter (system-level precision, no flourish)
- **Display font**: Instrument Serif — use ONLY for: stat numbers, clock time, brand wordmark, grand total values
- **Never** use Instrument Serif for: topbar titles, card headers, modal titles, table content, buttons, nav
- Page title (topbar): 16px, font-weight 600, Inter
- Card head: 15px, font-weight 600, Inter
- Modal title: 16px, font-weight 600, Inter
- Stat value: 32px, Instrument Serif (numbers deserve beauty)
- Body: 14px / 1.5, var(--gray-700)
- Small labels: 11px, uppercase, letter-spacing .7px, font-weight 600

## Sidebar (Dark — most important visual signal)
- Background: `#0c1a2e`
- Nav text default: `rgba(255,255,255,.54)`
- Nav text hover: `rgba(255,255,255,.88)`
- Nav text active: `#ffffff`
- Nav active bg: `rgba(255,255,255,.10)`
- Nav active left bar: `#60a5fa`
- Active icon: `#60a5fa`
- User card bg: `rgba(255,255,255,.06)`
- Sign out btn: transparent, `rgba(255,255,255,.44)` text

## Component Rules

### Cards
- White bg, `1px solid #eaecf0` border, `border-radius: 10px`
- Shadow: `0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)`
- Hover: elevate shadow slightly, `border-color: #d0d5dd`

### Stat Cards
- Always colored top bar (3px height) matching variant color
- `.blue` → accent navy top bar
- `.green` → emerald top bar
- `.amber` → amber top bar
- `.red` → red top bar
- Stat numbers in Instrument Serif 32px

### Buttons
- Primary: navy gradient `#1a4f8a → #123c6d`, white text, subtle inner highlight
- Secondary: white bg, `#d0d5dd` border, `#344054` text
- Success: emerald gradient, white text
- Danger: ghost with red text and light red border
- All: 8px border-radius, 13px font, 500 weight
- Always `transform: translateY(1px)` on `:active`

### Tables
- Thead: 11px, uppercase, letter-spacing .7px, `#f9fafb` bg
- Row padding: `13px 18px`
- Hover: `#f9fafb` background
- Last row: no border

### Modals
- Clean white, 14px border-radius
- Backdrop: `rgba(0,0,0,.5)` + `blur(4px)`
- Animation: `scale(.96) translateY(-8px)` → normal, 200ms
- Footer: `#f9fafb` background

### Badges
- All: pill shape (999px radius), 11px, 600 weight, uppercase, letter-spacing .4px
- Light color bg + matching border + dark text from same family
- Never use `color: white` on badges (reserved for buttons)

### Toast
- Bottom-center pill, dark bg, white text
- `ok` → emerald, `err` → red, `warn` → amber

## Clock Page
- Status card: `linear-gradient(135deg, #0c2a4e, #1a4f8a, #1f6baa)` navy gradient
- Large elapsed time: Instrument Serif 60px
- Clock-in btn: emerald gradient with strong green shadow
- Clock-out btn: red gradient with strong red shadow

## Spacing System (8px base)
- Card padding: 22px
- Card head padding: 16px 22px
- Page body padding: 30px 32px
- Gap between cards: 16px
- Topbar height: 60px
- Sidebar width: 260px

## What NOT to do
- No warm cream backgrounds on content area (login page only, subtly)
- No `font-family: var(--font-display)` on interactive UI text
- No blocking geo-fencing — always allow, flag for review
- No warm/brownish gray tones on main content (`#faf7f2` etc.) — that's the old v1 palette
- No heavy shadows or overly rounded (>18px) elements outside login card
- No gradients on page backgrounds (sidebar gradient is OK)
