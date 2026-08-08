import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#0B0F17",
          panel: "#111826",
          elevated: "#161F30"
        },
        border: {
          DEFAULT: "#232C3D"
        },
        ask: {
          DEFAULT: "#3B82F6",
          muted: "#1E3A5F"
        },
        modify: {
          DEFAULT: "#F97316",
          muted: "#4A2A11"
        },
        success: "#22C55E",
        danger: "#EF4444",
        muted: {
          foreground: "#8B95A7"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      borderRadius: {
        card: "0.75rem"
      }
    }
  },
  plugins: []
} satisfies Config;
