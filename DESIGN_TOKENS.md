# DEALXSTOCKS — DESIGN TOKENS & COLOR SYSTEM ARCHITECTURE

## 🎯 Single Source of Truth
The application uses a centralized 2-level Design Token Architecture to manage all brand and interface colors.

### Palette Visual Direction:
1. **Deep Navy Blue (`#254C73`)** — Primary Brand Accent & Active Controls
2. **Charcoal Gray (`#404040`)** — Secondary Controls & Dark Surface Neutrals
3. **Camel / Warm Brown (`#99633F`)** — Controlled Accent & Highlights
4. **Near Black (`#000608`)** — Dark Viewport Background
5. **Soft Light Gray (`#CCCCCC` / `#F8FAFC`)** — Light Viewport Background & Surfaces

---

## 🏛️ Token Hierarchy

### LEVEL 1 — Foundation Tokens (Primitives)
Defined in [`src/index.css`](file:///d:/Completd%20projects/Deal%20X%20Stocks/frontend/src/index.css) under `:root`:

- `--palette-navy-700`: `#254C73`
- `--palette-navy-800`: `#1B365D`
- `--palette-charcoal-700`: `#404040`
- `--palette-camel-600`: `#99633F`
- `--palette-camel-500`: `#B37549`
- `--palette-black-950`: `#000608`
- `--palette-charcoal-200`: `#CCCCCC`

### LEVEL 2 — Semantic Design Tokens
Consumed by UI components in Tailwind CSS:

| Token Name | Class Usage | Light Mode Value | Dark Mode Value | Semantic Role |
|---|---|---|---|---|
| `--color-primary` | `bg-primary`, `text-primary` | `#254C73` | `#32608F` | Primary buttons, active nav, main brand elements |
| `--color-secondary` | `bg-secondary`, `text-secondary` | `#404040` | `#333333` | Secondary actions, neutral badges |
| `--color-accent` | `bg-accent`, `text-accent` | `#99633F` | `#B37549` | Special highlights, badges, warm accents |
| `--color-background` | `bg-background` | `#F8FAFC` | `#000608` | Main viewport background |
| `--color-card` | `bg-card` | `#FFFFFF` | `#0B1726` | Card surfaces, dropdowns, tables, modals |
| `--color-sidebar` | `bg-sidebar` | `#F4F8FC` | `#080E14` | Left sidebar & bottom nav bar |
| `--color-border` | `border-border` | `#E2E8F0` | `#1E293B` | Card outlines & section dividers |

---

## 💻 Developer Guidelines

### 1. How to style components:
**GOOD (Semantic tokens):**
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl font-bold">
  Submit Action
</button>
<div className="bg-card text-foreground border border-card-border p-4 rounded-2xl">
  Card Content
</div>
```

**BAD (Hardcoded hexes or arbitrary colors):**
```tsx
/* DO NOT USE hardcoded hexes in component files */
<div className="bg-[#254C73] text-[#ffffff]">...</div>
```

### 2. Programmatic Usage in JS/TS:
Import tokens directly from [`src/lib/design-tokens.ts`](file:///d:/Completd%20projects/Deal%20X%20Stocks/frontend/src/lib/design-tokens.ts):
```ts
import { FOUNDATION_TOKENS, CHART_PALETTE } from "@/lib/design-tokens";

console.log(FOUNDATION_TOKENS.navy[700]); // "#254C73"
```

### 3. Adding New Color Themes:
To add a new theme or modify global brand colors, change ONLY the `:root` and `.dark` variables in [`src/index.css`](file:///d:/Completd%20projects/Deal%20X%20Stocks/frontend/src/index.css). The entire application across Landing Page, User Dashboard, Admin, and Super Admin will automatically update!
