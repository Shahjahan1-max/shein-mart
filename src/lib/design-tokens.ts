/**
 * DESIGN TOKENS SYSTEM — DEALXSTOCKS
 * Single Source of Truth for Brand Colors & Semantic Design Tokens
 * 
 * Visual Reference Palette:
 * - Deep Navy Blue: #254C73 (Primary Brand)
 * - Charcoal Gray: #404040 (Secondary / Surface Neutral)
 * - Camel / Warm Brown: #99633F (Accent)
 * - Near Black: #000608 (Dark Background)
 * - Soft Light Gray: #CCCCCC / #F8FAFC (Light Neutral)
 */

export const FOUNDATION_TOKENS = {
  navy: {
    950: "#0B1726",
    900: "#14283E",
    800: "#1B365D",
    700: "#254C73", // Primary Brand Reference Navy
    600: "#32608F",
    500: "#4278B0",
    400: "#6294C8",
    200: "#C2D7ED",
    100: "#E6EFF8",
    50:  "#F4F8FC",
  },
  charcoal: {
    950: "#171717",
    900: "#262626",
    800: "#333333",
    700: "#404040", // Reference Charcoal
    600: "#525252",
    500: "#737373",
    300: "#A3A3A3",
    200: "#CCCCCC", // Reference Soft Neutral Gray
    100: "#E5E5E5",
    50:  "#F5F5F5",
  },
  camel: {
    900: "#4A2B18",
    800: "#6E3F22",
    700: "#854D29",
    600: "#99633F", // Reference Camel / Warm Brown
    500: "#B37549",
    400: "#C88D60",
    200: "#ECCBAA",
    100: "#F7E8D8",
    50:  "#FAF3EC",
  },
  black: {
    950: "#000608", // Reference Near Black
    900: "#080E14",
    800: "#0E1722",
    700: "#152232",
  },
  white: "#FFFFFF",
} as const;

export const SEMANTIC_TOKENS = {
  light: {
    primary: FOUNDATION_TOKENS.navy[700],      // #254C73
    primaryHover: FOUNDATION_TOKENS.navy[800], // #1B365D
    secondary: FOUNDATION_TOKENS.charcoal[700],// #404040
    accent: FOUNDATION_TOKENS.camel[600],      // #99633F
    background: "#F8FAFC",
    surface: "#FFFFFF",
    sidebar: "#F4F8FC",
    border: "#E2E8F0",
    textPrimary: "#0F172A",
    textSecondary: "#64748B",
  },
  dark: {
    primary: FOUNDATION_TOKENS.navy[600],      // #32608F
    primaryHover: FOUNDATION_TOKENS.navy[700], // #254C73
    secondary: FOUNDATION_TOKENS.charcoal[800],// #333333
    accent: FOUNDATION_TOKENS.camel[500],      // #B37549
    background: FOUNDATION_TOKENS.black[950],  // #000608
    surface: FOUNDATION_TOKENS.navy[950],      // #0B1726
    sidebar: FOUNDATION_TOKENS.black[900],     // #080E14
    border: "#1E293B",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
  },
} as const;

/**
 * Chart Dataset Palette — for Recharts, Canvas, or Data Visualization
 */
export const CHART_PALETTE = [
  FOUNDATION_TOKENS.navy[700],   // #254C73 (Deep Navy)
  FOUNDATION_TOKENS.camel[600],  // #99633F (Warm Camel)
  FOUNDATION_TOKENS.charcoal[700],// #404040 (Charcoal)
  FOUNDATION_TOKENS.navy[500],   // #4278B0 (Slate Navy)
  FOUNDATION_TOKENS.camel[500],  // #B37549 (Light Camel)
] as const;