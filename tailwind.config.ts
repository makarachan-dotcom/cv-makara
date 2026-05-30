import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05060a",
          900: "#0a0c14",
          800: "#11141d",
          700: "#1a1e2b",
          500: "#3a4256",
          200: "#cbd1de",
          100: "#e8ecf3",
        },
        accent: {
          cyan: "#22d3ee",
          violet: "#8b5cf6",
          gold: "#facc15",
          rose: "#fb7185",
          emerald: "#34d399",
        },
      },
      fontFamily: {
        // `sans` defaults to Kantumruy Pro — it carries both Khmer + Latin
        // glyphs so the whole UI renders correctly with no font swapping.
        sans: ["var(--font-kantumruy)", "system-ui", "sans-serif"],
        kantumruy: ["var(--font-kantumruy)", "system-ui", "sans-serif"],
        hanuman: ["var(--font-hanuman)", "serif"],
        nokora: ["var(--font-nokora)", "sans-serif"],
        siemreap: ["var(--font-siemreap)", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      lineHeight: {
        // Khmer stacks subscripts (ជើងអក្សរ) below and vowels (ស្រៈ) above the
        // base glyph; tight line-heights clip them. These tokens are the safe
        // floor for on-screen and print rendering.
        khmer: "2.05",
        "khmer-tight": "1.85",
        "khmer-doc": "1.7",
      },
    },
  },
  plugins: [],
};

export default config;
