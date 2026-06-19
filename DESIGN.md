# LazyNevis — Design System

## Identity

**Name:** LazyNevis
**Tagline EN:** for lazy people who don't give upis.
**Tagline PT:** para quem é leizis, mas não desistis.
**Author:** Lucas "Sims" Nagasaki Souza

The "-is" suffix is a cultural reference to Mussum (Os Trapalhões, Brazil). It is intentional, not a typo. Always explain this in About pages and documentation — do not remove it.

---

## Color Palette

### Semantic tokens (CSS variables)

```css
/* Light */
--background: 0 0% 100%
--foreground: 224 71.4% 4.1%
--card: 0 0% 100%
--primary: 220.9 39.3% 11%
--secondary: 220 14.3% 95.9%
--muted: 220 14.3% 95.9%
--muted-foreground: 220 8.9% 46.1%
--accent: 220 14.3% 95.9%
--destructive: 0 84.2% 60.2%
--border: 220 13% 91%

/* Dark (automatic via .dark class) */
--background: 224 71.4% 4.1%
--card: 224 71.4% 6%
--primary: 210 20% 98%
/* etc — see src/index.css */
```

### Session status colors

| State | Color | Usage |
|---|---|---|
| Focused | `bg-green-500` (animating) | Status dot, focus timer |
| Distracted | `bg-red-500` (animating) | Status dot, distraction timer |
| Paused | `bg-yellow-500` | Status dot |
| Idle | `bg-blue-400` | Status dot, idle timer |
| Inactive | `bg-muted-foreground/20` | Status dot when no session |

### Timeline colors

- **Focus blocks**: deterministic hsl from app name hash, hues [155,175,200,220,245,270]
- **Distraction blocks**: `#ef4444` (red-500)
- **Event start ticks**: `bg-amber-400/70`
- **Checkpoint markers**: `bg-yellow-400`

### Alert overlay

- **Red phase**: `rgba(214, 48, 49, 0.88)` — `#D63031` at 88% opacity
- **Blue phase**: `rgba(9, 132, 227, 0.88)` — `#0984E3` at 88% opacity
- Animates at ~30fps, toggles every 30 frames (~500ms)

---

## Typography

- **Font**: system font stack (no custom font bundled)
- **Monospace** (timers, hotkeys, file paths): `font-mono`
- **Timer values**: `font-mono font-bold tabular-nums`
- **Section titles**: `font-semibold text-base`
- **Hints/descriptions**: `text-xs text-muted-foreground leading-relaxed`

---

## Component Patterns

### SettingRow

Used in all Settings tabs. Accepts `icon`, `label`, `hint`.

```tsx
<SettingRow icon={<Icon />} label="Setting name" hint="Explanation of what this does">
  <Control />
</SettingRow>
```

### SectionTitle

Tab header with icon, title (from i18n), and description (from i18n).

```tsx
<SectionTitle icon={<Icon />} titleKey="settings.tabs.xxx" descKey="settings.section_desc.xxx" t={t} />
```

### Card layout

Minimal cards with `rounded-xl border bg-card shadow-sm`. Interactive cards add `hover:bg-accent/50 cursor-pointer transition-colors`.

### Status badges

- **Success (green)**: `variant="success"` — focus score, focus time
- **Warning (yellow)**: `variant="warning"` — alerts, medium focus
- **Destructive (red)**: poor focus scores

---

## Window Layout

```
┌────────────┬────────────────────────────┐
│  Sidebar   │  Main content area         │
│  (w-16)    │  (flex-1, overflow-hidden)  │
│            │                            │
│  [icon]    │  Each page manages its own  │
│  [dot]     │  internal scroll            │
│  [nav]     │                            │
│  [nav]     │                            │
│  [nav]     │                            │
│  [nav]     │                            │
└────────────┴────────────────────────────┘
```

- Min window: 640×480px
- Default: 900×680px
- Sidebar: fixed 64px wide, icon navigation only

---

## i18n Rules

1. **Every user-visible string** goes through `t("key")`
2. Key format: `section.subsection.key`
3. Both `en-US.json` and `pt-BR.json` must have identical keys
4. **Dates**: use `formatDate(ms, locale)` → DD/MM/YYYY (pt-BR) or MM/DD/YYYY (en-US)
5. **Times**: use `formatTime(ms, locale)` → HH:mm:ss (24h)
6. **Durations**: use `formatDuration(ms)` (HH:MM:SS) or `formatDurationHuman(ms)` (2h 30m)

---

## UX Principles

1. **Clarity first** — product value before jokes
2. **No hardcoded text** in any language inside JSX
3. **All destructive actions need confirmation** (modal with Cancel/Confirm)
4. **Settings auto-save** with 500ms debounce
5. **Empty states** are informative, not just blank
6. **Tooltips** on icons, abbreviated labels, and technical fields
7. **Toast duration**: 3 seconds
8. **Minimum window size**: 640×480
