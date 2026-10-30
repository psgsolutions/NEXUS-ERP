import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Security headers ทุกหน้า (C-11)
 * - CSP: โหลดสคริปต์/สไตล์จากเว็บเราเองเท่านั้น · เชื่อมต่อ Firebase (Auth/Firestore) · data:/blob: สำหรับ PDF (wasm ตัวจัดหน้า, ไฟล์ PDF ที่สร้างในเบราว์เซอร์) และรูปบิล
 *   'unsafe-inline' ของสคริปต์จำเป็นสำหรับสคริปต์เริ่มต้นของ Next.js · 'wasm-unsafe-eval' สำหรับตัวจัดหน้า PDF (yoga wasm)
 *   'unsafe-eval' เฉพาะตอน next dev (hot reload)
 * - ห้ามเว็บอื่นฝังหน้าระบบ (กันหลอกกดปุ่ม) · บังคับ HTTPS · ส่ง referrer เฉพาะโดเมน
 * - อุปกรณ์: ใช้ตำแหน่ง (ลงเวลา/ช่างเช็กอิน) และกล้องได้เฉพาะเว็บเรา ปิดไมโครโฟน/การชำระเงิน
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' data: blob: https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com${isDev ? " ws: http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "frame-src 'self' blob: https://*.firebaseapp.com",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
