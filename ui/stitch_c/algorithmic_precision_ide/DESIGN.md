---
name: Algorithmic Precision IDE
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#005a89'
  on-tertiary: '#ffffff'
  tertiary-container: '#0073ae'
  on-tertiary-container: '#e7f2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1rem
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.5rem
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.375rem
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  margin: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system is engineered for competitive programmers, algorithmic engineers, and computer science students operating under intense focus and strict time limits. The environment balances extreme density with absolute optical clarity. The emotional atmosphere is cerebral, disciplined, calm, and unmistakably technical—evoking the surgical precision of modern engineering tools like VS Code and GitHub Desktop.

The visual direction unites **Modern Developer Minimalism** with structural **Tonal Layering**:
- Uncluttered, high-legibility workspaces that strip away visual noise in favor of code structure and algorithmic output.
- Crisp 1px geometric borders that distinctly partition multi-pane execution environments (problem statements, code editors, test-case runners, terminal consoles).
- Purpose-driven chromatic signaling: neutral scaffolding keeps mental fatigue low, while vibrant, unambiguous semantic colors immediately communicate critical execution states (Accepted, Time Limit Exceeded, Wrong Answer, Runtime Error).

## Colors

The palette is strictly calibrated for sustained hours of reading complex algorithmic problem descriptions, writing syntax-heavy code, and analyzing execution diffs under bright ambient light.

### Color Tiers & Palette
- **Canvas Base (`#f8fafc`)**: The foundational canvas for the entire application frame and background gutters.
- **Surface Elevation (`#ffffff`)**: The active editing surface, primary problem statement panel, and modal sheets. Provides maximum contrast for text and syntax highlighting.
- **Surface Inset & Panes (`#f1f5f9`)**: Subordinate panels including test suite trays, terminal outputs, tab headers, and collapsed sidebars.
- **Subtle Partition Border (`#e2e8f0`)**: Universal structural line token for pane splitters, table cell dividers, and container bounds.
- **Active Structural Border (`#cbd5e1`)**: Hover states, active pane focus boundaries, and selected tab indications.

### Accent & Semantic Roles
- **Primary Tech Blue (`#2563eb`)**: Active tab underlines, cursor focus rings, primary action triggers ("Run Code", "Submit"), and syntax function names.
- **Tertiary Cyan (`#0284c7`)**: Informational highlights, memory limit indicators, and tag badges.
- **Accepted Green (`#10b981`)**: Dedicated to the "Accepted" (AC) status, passing unit tests, and performance benchmark milestones.
- **Wrong Answer Red (`#ef4444`)**: Failing test cases, "Wrong Answer" (WA), compilation errors, and diff deletions.
- **Warning & TLE Amber (`#f59e0b`)**: "Time Limit Exceeded" (TLE), memory overhead alerts, and optimization suggestions.
- **Neutral Foregrounds**:
  - `text-primary` (`#0f172a`): Code, headers, active metrics.
  - `text-secondary` (`#475569`): Problem descriptions, input/output labels.
  - `text-muted` (`#94a3b8`): Line numbers, inactive breadcrumbs, keyboard shortcuts.

## Typography

The typographical structure is bifurcated by purpose:
1. **Interface & Prose (Inter)**: Delivers exceptional optical clarity at compact UI sizes (11px to 14px), with tall x-height and tight tracking for problem statements, metrics, and nested hierarchies.
2. **Execution & Code (JetBrains Mono)**: A monospaced powerhouse engineered specifically for developers. Contains increased letter height, crisp distinction between ambiguous glyphs (`0` vs `O`, `1` vs `l` vs `I`), standard tabular figures, and full ligature support for programming operators (`!=`, `=>`, `===`, `::`).

### Hierarchy & Treatment
- Headings use negative letter-spacing for tight, confident titles.
- Code blocks maintain a standard 1.5 line height ratio to ensure comfortable code scanning without ocular fatigue.
- Metrics, memory usages (`34.2 MB`), runtime measurements (`12 ms`), and test vectors strictly use `JetBrains Mono` at `code-sm` or `code-md` to preserve tabular visual alignment.

## Layout & Spacing

This design system is tailored for dense, multi-pane desktop productivity. It abandons loose consumer-web margins in favor of a compact **Workbench Grid / Tiled Splitter Layout**:

### Grid & Pane System
- **Viewport Layout**: Fixed-height, 100vh workbench composed of resizable multi-axis split views (Left: Problem Context & Constraints; Center: Code Workspace; Bottom/Right: Test Case Harness & Submission Telemetry).
- **Split Gutters**: Ultra-narrow 4px to 8px separators between resizable tiles with a 1px visible hairline rule (`#e2e8f0`).
- **Inner Pane Padding**: Default internal padding is `space-lg` (16px) for problem reading, collapsing down to `space-sm` (8px) or `space-xs` (4px) inside code editor gutters, terminal headers, and action toolbars.

### Breakpoints & Adaptability
- **Desktop Focus**: Primary target is `1280px` to `2560px` multi-monitor widescreen configurations.
- **Tablet / Secondary Screen (1024px and below)**: Reflows side-by-side vertical panels into tabbed or stacked drawers to preserve a minimum 80-column code editor width.

## Elevation & Depth

Visual hierarchy is maintained almost entirely through **tonal transitions and razor-sharp border boundaries**, avoiding deep fuzzy shadows that clutter complex interfaces.

- **Level 0 (Base Canvas)**: `#f8fafc` — Non-interactive application backgrounds and root frames.
- **Level 1 (Panels & Toolbars)**: `#ffffff` or `#f1f5f9` framed by a 1px border (`#e2e8f0`). No drop shadow. Depth is communicated strictly by contrast against adjacent neutral tiers.
- **Level 2 (Popovers, Context Menus, Autocomplete)**: `#ffffff` surrounded by a 1px border (`#cbd5e1`) and a clean, technical shadow:
  `box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04);`
- **Level 3 (Modals, Diff Comparison Overlays)**: Centered container floating over a light backdrop blur (`backdrop-filter: blur(2px); background: rgba(15, 23, 42, 0.2)`), elevated with:
  `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04);`
- **Active Focus Elevation**: No shadow displacement; instead, targeted panels and active inputs receive a high-contrast 1.5px border or focus ring in `#2563eb`.

## Shapes

The design system employs a **Soft / High-Utility Precision** geometry (`roundedness: 1`). Rounding is restrained to maintain an industrial, compact IDE appearance.

- **Micro Components (Tags, Tab Pills, Inputs, Buttons)**: `4px` (`0.25rem`) corner radius. This prevents lost interactive surface area while softening harsh rectangular corners.
- **Panels & Cards**: `6px` to `8px` (`0.375rem` to `0.5rem`) on parent container boundaries, keeping internal content tight against borders.
- **Modals & Overlays**: `8px` (`0.5rem`) maximum radius.
- **Status Badges & Test Indicators**: Subtle 4px radius or rectangular pill formats (no oversized circular bubbles) to blend harmoniously alongside code lines.

## Components

### Buttons
- **Primary ("Submit Solution")**: Solid `#2563eb` fill, `#ffffff` text, font weight 500. Subtle hover state to `#1d4ed8`. Crisp 4px border radius.
- **Secondary ("Run Tests")**: White `#ffffff` background, 1px border in `#cbd5e1`, text `#0f172a`. Hover transitions to `#f8fafc` with border `#94a3b8`.
- **Tertiary / Utility (Icon Buttons, Copy Code)**: Transparent surface, text `#475569`, hover to `#f1f5f9`.

### Status Badges & Chips
- **Accepted (AC)**: Background `#ecfdf5`, border `1px solid #a7f3d0`, text `#065f46`, font `JetBrains Mono` weight 600.
- **Wrong Answer (WA)**: Background `#fef2f2`, border `1px solid #fecaca`, text `#991b1b`.
- **Time Limit Exceeded (TLE)**: Background `#fffbeb`, border `1px solid #fde68a`, text `#92400e`.
- **Language / Tag Chips**: Background `#f1f5f9`, border `1px solid #e2e8f0`, text `#334155`, font `JetBrains Mono` at `0.75rem`.

### Code Editor & Syntax Surfaces
- **Gutter & Line Numbers**: Background `#f8fafc`, right border `1px solid #e2e8f0`, numbers in `#94a3b8`, active line number in `#0f172a` (semi-bold).
- **Active Line Highlight**: `background: rgba(241, 245, 249, 0.6)`.
- **Syntax Palette (Light)**:
  - Keywords: `#cf222e` (Crimson red)
  - Functions / Methods: `#8250df` (Purple)
  - Strings: `#0a3069` (Deep Navy) or `#116329` (Forest Green)
  - Comments: `#6e7781` (Muted Slate, italicized)
  - Variables / Parameters: `#24292f`
  - Constants / Numbers: `#0550ae` (Refined Blue)

### Test Case Runner & Console
- Segmented tab controls for `Case 1`, `Case 2`, `Custom Testcase`, featuring status dot indicators (Green = Passed, Red = Failed, Gray = Unexecuted).
- Input/Output diff viewer utilizing side-by-side or inline view with `#dcfce7` (addition) and `#fee2e2` (omission) highlighting.

### Input Fields & Controls
- **Text Inputs & Filter Bars**: 1px border `#e2e8f0`, background `#ffffff`, text `#0f172a`. Focus creates a `2px solid #2563eb` ring with zero shadow blur.
- **Checkboxes & Radios**: 14px compact footprint, `#ffffff` base, `#2563eb` checked accent fill.