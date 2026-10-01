import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@tiptap/react', '@react-pdf/renderer', 'firebase', 'firebase-admin'],
  },
  allowedDevOrigins: ['192.168.139.7'],
};

export default nextConfig;