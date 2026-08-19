"use client";

import React, { useState, useEffect } from 'react';
import { Modal, PillButton } from '@/components/ui/Base';
import { Download, Printer } from 'lucide-react';
import dynamic from 'next/dynamic';

// Next.js requires dynamic import with SSR disabled for react-pdf Viewer
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFViewer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-white/50">กำลังโหลด PDF Engine...</div>
});

const DocumentRenderer = dynamic(() => import('@/lib/pdf/DocumentRenderer').then(mod => mod.DocumentRenderer), {
  ssr: false
});

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  blocks: any[];
  data: any;
}

export function PDFPreviewModal({ isOpen, onClose, blocks, data }: PDFPreviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`ตัวอย่างเอกสาร PDF (NEXUS Engine)`}
      maxWidth="max-w-[1000px]"
    >
      <div className="flex flex-col h-[80vh] bg-[#0D0D0D]">
        {mounted && blocks && blocks.length > 0 ? (
          <PDFViewer width="100%" height="100%" className="border-0 bg-white">
            {/* @ts-ignore */}
            <DocumentRenderer blocks={blocks} data={data} />
          </PDFViewer>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/50">
            {mounted ? "ไม่พบโครงสร้างแม่แบบเอกสาร (Blocks)" : "กำลังเปิดระบบ..."}
          </div>
        )}
      </div>
    </Modal>
  );
}
