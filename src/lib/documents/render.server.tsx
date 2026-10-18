import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentPdf, registerDocumentFonts } from "@/lib/pdf/DocumentPdf";
import type { CopyMode, DocumentModel } from "./model";

/**
 * สร้าง PDF ฝั่ง server
 * ฟอนต์: ใช้ไฟล์ใน public/fonts ถ้ามีบนเครื่อง (dev) ไม่งั้นโหลดจาก origin ของเว็บ (Vercel ไม่มี public ใน function)
 */
function fontBase(origin: string) {
  const local = path.join(process.cwd(), "public");
  return fs.existsSync(path.join(local, "fonts", "Sarabun-Regular.ttf")) ? local : origin;
}

export async function renderDocumentPdf(doc: DocumentModel, copy: CopyMode, origin: string): Promise<Buffer> {
  registerDocumentFonts(fontBase(origin));
  return renderToBuffer(<DocumentPdf doc={doc} copy={copy} />);
}

/** ชื่อไฟล์: QT-2610-0001.pdf (ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้) */
export const pdfFileName = (doc: DocumentModel, copy: CopyMode) =>
  `${(doc.number || doc.type).replace(/[\\/:*?"<>|\s]+/g, "-")}${copy === "copy" ? "-copy" : ""}.pdf`;
