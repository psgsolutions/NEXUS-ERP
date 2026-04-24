import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b", // Zinc-950 Tactical Dark [Blueprint]
        foreground: "#ffffff",
        nexus: {
          blue: "#14A3CC", // Azure Blue [Blueprint]
          teal: "#10BBA8", // Aquamarine Teal [Blueprint]
          zinc: {
            900: "#18181b",
            950: "#09090b",
          }
        },
        success: "#2DD4BF", // Teal-400
        warning: "#FBBF24", // Amber-400
        danger: "#F43F5E",  // Rose-500
      },
      borderRadius: {
        full: "9999px",
        pill: "9999px",
      },
      height: {
        '9': '36px',
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backdropBlur: {
        nexus: '12px', // backdrop-blur-md equivalent [Blueprint]
      },
      boxShadow: {
        'nexus-glow': '0 0 20px rgba(20, 163, 204, 0.15)',
        'glass-glow': '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
};
export default config;
