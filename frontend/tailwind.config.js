/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
        "2xl": "24px",
        pill: "9999px",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: {
          DEFAULT: "#00C9A7",
          dark: "#00A88E",
          light: "#E0FBF5",
          foreground: "#FFFFFF",
        },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: {
          DEFAULT: "#FF6B35",
          dark: "#E85A26",
          light: "#FFF0EB",
          foreground: "#FFFFFF",
        },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        navy: { 
          DEFAULT: "#0B0E11", 
          900: "#0B0E11", 
          800: "#141A21", 
          700: "#1C242D", 
          medium: "#111F35", 
          light: "#1A2D45", 
          lighter: "#243B55" 
        },
        teal: {
          500: "#00D1B2",
          400: "#14E0C2",
          600: "#00B398",
        },
        surface: { light: "#F5F4F0", dark: "#0A1628" },
        cat: {
          flat: "#6366F1", "flat-light": "#EEF2FF",
          pharmacy: "#10B981", "pharmacy-light": "#D1FAE5",
          hospital: "#EF4444", "hospital-light": "#FEE2E2",
          fashion: "#F59E0B", "fashion-light": "#FEF3C7",
        },
        star: "#FBBF24",
      },
      fontFamily: {
        sora: ["Sora", "sans-serif"],
        dmsans: ['"DM Sans"', "sans-serif"],
        bengali: ['"Noto Sans Bengali"', "sans-serif"],
      },
      boxShadow: {
        teal: "0 4px 20px rgba(0, 201, 167, 0.25)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        pulseRing: { "0%": { transform: "scale(1)", opacity: "0.8" }, "100%": { transform: "scale(2)", opacity: "0" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 4s ease-in-out infinite",
        "pulse-ring": "pulseRing 2s ease-out infinite",
        shimmer: "shimmer 1.5s ease infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
