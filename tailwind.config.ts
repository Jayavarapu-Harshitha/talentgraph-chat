import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0D1B2A",
        "navy-mid": "#152236",
        crimson: "#B92B2B",
        "crimson-l": "#D44040",
        steel: "#2E6DA4",
        "steel-l": "#4A8CC4",
        "off-white": "#F6F5F1",
        bg: "#F2F4F8",
        card: "#FFFFFF",
        border: "#DDE0E8",
        txt: "#1A1F2E",
        "txt-mid": "#4A5568",
        "txt-soft": "#718096",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
      },
      keyframes: {
        "slide-in": {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "typing-bounce": {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-5px)" },
        },
        "drawer-slide": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "save-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "slide-in": "slide-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "typing-bounce": "typing-bounce 1.2s infinite",
        "drawer-slide": "drawer-slide 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        "save-pulse": "save-pulse 1s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
