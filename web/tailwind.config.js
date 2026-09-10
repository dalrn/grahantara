import { scoreColors } from "./src/design.js";
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#65dfbb",
        surface: "#20332e",
        score: Object.fromEntries(
          scoreColors.map((color, i) => [i + 1, color]),
        ),
        slate: {
          950: "#172925",
          900: "#20332e",
          800: "#293e38",
          700: "#3b554d",
          600: "#859f96",
          500: "#98ada5",
          400: "#b8c9c2",
          300: "#d2ded9",
          200: "#e1e9e5",
          100: "#f0f5f2",
        },
        emerald: {
          300: "#a0efd4",
          400: "#65dfbb",
          500: "#65dfbb",
          600: "#27866d",
        },
      },
      fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem" }],
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.5rem" }],
        base: ["1rem", { lineHeight: "1.625rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
      },
      borderRadius: { lg: "14px", xl: "20px", "2xl": "28px" },
      transitionDuration: { micro: "200ms", panel: "300ms" },
      transitionTimingFunction: {
        enter: "cubic-bezier(.22,1,.36,1)",
        exit: "ease-in",
      },
    },
  },
  plugins: [],
};
