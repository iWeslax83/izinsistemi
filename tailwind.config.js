/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#f7f5f1",
        surface: "#ffffff",
        paper: "#fdfcf9",
        ink: {
          DEFAULT: "#1c1917",
          muted: "#6b7280",
          soft: "#a8a29e",
        },
        line: "#e7e5e0",
        accent: {
          DEFAULT: "#c2410c",
          hover: "#9a3412",
          soft: "#fed7aa",
          glow: "#f97316",
        },
        ok: {
          DEFAULT: "#16a34a",
          soft: "#dcfce7",
          ink: "#166534",
        },
        warn: {
          DEFAULT: "#d97706",
          soft: "#fef3c7",
          ink: "#92400e",
        },
        danger: {
          DEFAULT: "#dc2626",
          soft: "#fee2e2",
          ink: "#991b1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 25, 23, 0.04), 0 1px 3px rgba(28, 25, 23, 0.06)",
        pop: "0 4px 12px rgba(28, 25, 23, 0.08)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
      },
    },
  },
  plugins: [],
};
