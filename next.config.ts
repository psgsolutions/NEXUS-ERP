import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // build ทดสอบในเครื่องโดยไม่ชนกับ dev server (ค่าเริ่มต้น .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: false,
  },
  // สร้าง PDF ฝั่ง server (/api/documents/pdf): ให้ Node โหลด react-pdf ตรง ไม่ผ่าน bundler
  serverExternalPackages: ['@react-pdf/renderer'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@tiptap/react', 'firebase', 'firebase-admin'],
  },
  allowedDevOrigins: ['192.168.139.7'],
};

export default nextConfig;