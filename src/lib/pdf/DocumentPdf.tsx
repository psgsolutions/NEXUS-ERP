import React from "react";
import type { CopyMode, DocumentModel } from "@/lib/documents/model";
import { StandardDocument, registerDocumentFonts } from "./StandardDocument";
import { Wht50Document } from "./Wht50Document";

/** เลือกเทมเพลตตามเอกสาร: แบบฟอร์มทางราชการ (50 ทวิ) หรือเทมเพลตมาตรฐาน */
export function DocumentPdf({ doc, copy = "original" }: { doc: DocumentModel; copy?: CopyMode }) {
  return doc.wht50 ? <Wht50Document doc={doc} copy={copy} /> : <StandardDocument doc={doc} copy={copy} />;
}

export { registerDocumentFonts };
