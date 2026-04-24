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
        background: "var(--background)",
        foreground: "var(--foreground)",
        "nexus-blue": "#0090FF",
        "nexus-teal": "#00FFD1",
        danger: "#FF3B30",
        warning: "#FFCC00",
      },
      boxShadow: {
        'neon-teal': '0 0 15px rgba(0, 255, 209, 0.4)',
        'neon-blue': '0 0 15px rgba(0, 144, 255, 0.4)',
        'neon-danger': '0 0 15px rgba(255, 59, 48, 0.4)',
        'neon-emerald': '0 0 15px rgba(16, 185, 129, 0.4)',
        'neon-amber': '0 0 15px rgba(245, 158, 11, 0.4)',
        'neon-purple': '0 0 15px rgba(168, 85, 247, 0.4)',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        sans: ["var(--font-sarabun)", "sans-serif"],
        thai: ["var(--font-sarabun)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        scan: {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        pulse_glow: {
          '0%, 100%': { opacity: '0.4', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      animation: {
        scan: 'scan 3s linear infinite',
        'pulse-glow': 'pulse_glow 2s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
