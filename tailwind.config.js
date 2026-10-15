/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark theme uses the `zinc` scale exclusively; remap it to GitHub
        // Desktop's "dark dimmed" palette (Primer) for a softer, less-black
        // look. Light theme uses `neutral`, so it is unaffected.
        zinc: {
          50: "#f0f3f6",
          100: "#e1e4e8",
          200: "#d1d5da", // default text
          300: "#a0a8b0",
          400: "#8b949e", // muted text
          500: "#6e7681", // subtle text
          600: "#4a5058",
          700: "#3f454d", // borders
          800: "#2f363d", // raised surfaces: headers, selected rows, buttons
          900: "#24292e", // panels, toolbar canvas
          950: "#1b1f24", // app background (deepest, behind panels)
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "JetBrains Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
