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
        "nexus-blue": "#14a3cc",
        "nexus-teal": "#10bba8",
        danger: "#ef4444",
        warning: "#f59e0b",
      },
      boxShadow: {
        'nexus-glow': '0 0 20px rgba(20, 163, 204, 0.4)',
        'nexus-teal-glow': '0 0 20px rgba(16, 187, 168, 0.4)',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
