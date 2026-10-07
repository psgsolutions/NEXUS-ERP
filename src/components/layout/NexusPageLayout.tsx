import React from 'react';
import { cn } from "@/lib/utils";

export default function NexusPageLayout({ 
  header, 
  leftContent, 
  rightSidebar,
  topContent,
  footer,
  className 
}: { 
  header: React.ReactNode; 
  leftContent: React.ReactNode; 
  rightSidebar?: React.ReactNode; 
  topContent?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    // 1. บังคับ Full-Page และคุมพื้นหลัง Dark Theme แต่อยู่ภายในขอบเขตของ Layout หลัก (ไม่ซ้อนทับ Sidebar)
    <div className={cn("w-full h-full min-h-[100vh] flex flex-col bg-surface-0 overflow-hidden font-sans relative z-10", className)}>
      
      {/* Header: ตรึงนิ่งสนิทตามกฎ */}
      <header className="flex-none sticky top-0 z-50 bg-surface-0/80 backdrop-blur-md border-b border-white/10">
        <div className="px-4 xl:px-6 py-2.5 xl:py-3 w-full">
          {header}
        </div>
      </header>

      {/* Optional Full-width Top Content */}
      {topContent && (
        <div className="flex-none w-full animate-in fade-in duration-700">
          {topContent}
        </div>
      )}

      {/* Main Container: แบ่งพื้นที่และทำ Independent Scrolling */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden w-full">
        
        {/* ฝั่งซ้าย: เลื่อนเฉพาะส่วนนี้ถ้าเนื้อหายาว */}
        <main className={cn(
          "flex-1 overflow-y-auto p-4 xl:p-6 custom-scrollbar pb-32 xl:pb-6",
          "min-w-0",
          rightSidebar ? "w-full xl:w-auto" : "w-full"
        )}>
          {leftContent}
        </main>

        {/* ฝั่งขวา: แผงสรุปยอดเกาะติดหน้าจอ หรือเลื่อนแยกอิสระ */}
        {rightSidebar && (
          // แผงขวา: ไม่แคบจนข้อมูลถูกตัด (13") และไม่กว้างเกินจำเป็น (27")
          <aside className="w-full xl:w-[clamp(310px,24%,400px)] flex-none min-w-0 border-t xl:border-t-0 xl:border-l border-white/10 bg-white/[0.02] overflow-y-auto overflow-x-hidden custom-scrollbar">
            {rightSidebar}
          </aside>
        )}
      </div>

      {/* Footer: แถบคำสั่งด้านล่าง sticky */}
      {footer && (
        <footer className="flex-none sticky bottom-0 z-40 bg-surface-0/95 backdrop-blur-xl border-t border-white/10">
          <div className="px-4 xl:px-6 py-3 w-full">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}
