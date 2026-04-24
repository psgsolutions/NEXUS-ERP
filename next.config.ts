import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* [DEP-01] Production Runtime Configuration */
  // DO NOT use output: 'export' to support Server Actions and AI Genkit
  
  typescript: {
    // Ensuring production builds are strict
    ignoreBuildErrors: false,
  },
  eslint: {
    // Ensuring code quality before deploy
    ignoreDuringBuilds: false,
  },
  /* Experimental features for Next.js 15 */
  experimental: {
    // Add any specific experimental features if needed
  }
};

export default nextConfig;
