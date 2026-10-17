import { defineConfig } from "vitest/config";
import path from "node:path";

// unit test ของฟังก์ชันที่ไม่แตะฐานข้อมูล (ชุดทดสอบกับฐานข้อมูลจริงและ rules แยกไว้ต่างหาก)
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
  },
});
