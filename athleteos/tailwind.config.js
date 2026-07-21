// tailwind.config.js — AthleteOS Premium Design System
/** @type {import('tailwindcss').Config} */
export default {
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
        // Palette étendue
        "accent-dark":  "#16826C",
        "accent-light": "#E8F7F2",
        "surface":      "#F5F5F2",
        "surface-card": "#FFFFFF",
      },
      // Shadows premium — profondeur réelle sans lourdeur
      boxShadow: {
        "card":    "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
        "card-md": "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)",
        "card-lg": "0 4px 16px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.08)",
        "glow-green":  "0 0 20px rgba(29,158,117,0.25)",
        "glow-amber":  "0 0 20px rgba(239,159,39,0.25)",
        "glow-danger": "0 0 20px rgba(226,75,74,0.25)",
        "inner-sm": "inset 0 1px 3px rgba(0,0,0,0.06)",
        "nav":  "2px 0 20px rgba(0,0,0,0.06)",
      },
      // Border radius custom
      borderRadius: {
        "2.5xl": "20px",
        "3xl":   "24px",
        "4xl":   "32px",
      },
      // Keyframes — tous utiles, aucun gadget
      keyframes: {
        // Entrée de vue principale — glisse depuis le bas, très subtil
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Entrée latérale (sidebar items)
        "slide-right": {
          "0%":   { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Fade simple pour modals et overlays
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Scale pour cards et boutons au tap
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Shimmer pour skeleton / hover premium
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Pulse doux pour badges live
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.6" },
        },
        // Bounce léger pour badges notification
        "bounce-in": {
          "0%":   { opacity: "0", transform: "scale(0.3)" },
          "50%":  { opacity: "1", transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        // Gradient animé pour le hero athlète
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        // Spin custom pour loaders
        "spin-smooth": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "slide-up":       "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up-delay": "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
        "slide-right":    "slide-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in":        "fade-in 0.2s ease both",
        "scale-in":       "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        "shimmer":        "shimmer 2s linear infinite",
        "pulse-soft":     "pulse-soft 2s ease-in-out infinite",
        "bounce-in":      "bounce-in 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
        "gradient-shift": "gradient-shift 4s ease infinite",
        "spin-smooth":    "spin-smooth 0.8s linear infinite",
      },
      // Transitions custom
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)",
        "snap":   "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
      },
      // Backdrop blur pour glassmorphism
      backdropBlur: {
        "xs": "2px",
      },
    },
  },
  plugins: [],
};