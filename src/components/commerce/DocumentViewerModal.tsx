"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Modal, PillButton } from "@/components/ui/Base";
import { Printer, Download, X } from "lucide-react";
import { NexusDocumentTemplate } from "@/lib/pdf/NexusDocumentTemplate";

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false, loading: () => <div className="flex justify-center items-center h-full text-white/50">กำลังโหลด PDF Engine...</div> }
);

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData: any; // Mapped to NexusDocumentProps
  documentType: string;
}

export function DocumentViewerModal({ isOpen, onClose, documentData, documentType }: DocumentViewerModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen || !documentData) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`ระบบออกเอกสาร: ${documentType}`}
      maxWidth="max-w-[1200px]"
    >
      <div className="flex flex-col h-[85vh] bg-surface-0">
        
        {/* Tool Bar */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-surface-1">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-nexus-teal uppercase tracking-widest">{documentData.docNo}</h4>
            <p className="text-[11px] text-white/40">เอกสารพร้อมพิมพ์</p>
          </div>
          
          <div className="flex gap-3">
             <PillButton variant="glass" onClick={onClose} className="border-white/20 text-white/60">
               <X size={16} className="mr-2" />
               ปิดหน้าต่าง
             </PillButton>
             {/* Note: React-PDF PDFViewer has its own download/print buttons on its toolbar, but we can style our own if using PDFDownloadLink */}
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-surface-2 relative">
          {isMounted && (
            <PDFViewer width="100%" height="100%" className="border-0">
              <NexusDocumentTemplate data={documentData} />
            </PDFViewer>
          )}
        </div>
        
      </div>
    </Modal>
  );
}
