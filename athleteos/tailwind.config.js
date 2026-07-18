// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  // Indique à Tailwind quels fichiers scanner pour purger les classes inutilisées
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        accent:  "#1D9E75",
        amber:   "#EF9F27",
        danger:  "#E24B4A",
        info:    "#378ADD",
      },
    },
  },
  plugins: [],
};