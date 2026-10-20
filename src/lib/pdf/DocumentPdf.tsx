import React from "react";
import type { CopyMode, DocumentModel } from "@/lib/documents/model";
import { StandardDocument, registerDocumentFonts } from "./StandardDocument";
import { Wht50Document } from "./Wht50Document";
import { LetterDocument } from "./LetterDocument";
import { FreeLayoutDocument } from "./FreeLayoutDocument";
import { resolveDesign } from "@/lib/documents/design";

/** เลือกเทมเพลตตามเอกสาร: หนังสือ, แบบฟอร์มทางราชการ (50 ทวิ) หรือเทมเพลตมาตรฐาน */
export function DocumentPdf({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  if (doc.letter) return <LetterDocument doc={doc} />;
  // ผังลากวางอิสระของเอกสารชนิดนี้ (ตั้งค่า › ออกแบบเอกสาร)
  if (!doc.wht50 && resolveDesign(doc.seller.design, doc.type, doc.seller.brandColor).doc.free?.enabled) return <FreeLayoutDocument doc={doc} copy={copy} />;
  return doc.wht50 ? <Wht50Document doc={doc} copy={copy} /> : <StandardDocument doc={doc} copy={copy} />;
}

export { registerDocumentFonts };
