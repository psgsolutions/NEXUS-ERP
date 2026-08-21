import React from 'react';
import { cn } from "@/lib/utils";

export default function NexusPageLayout({ 
  header, 
  leftContent, 
  rightSidebar,
  topContent,
  className 
}: { 
  header: React.ReactNode; 
  leftContent: React.ReactNode; 
  rightSidebar?: React.ReactNode; 
  topContent?: React.ReactNode;
  className?: string;
}) {
  return (
    // 1. บังคับ Full-Page และคุมพื้นหลัง Dark Theme แต่อยู่ภายในขอบเขตของ Layout หลัก (ไม่ซ้อนทับ Sidebar)
    <div className={cn("w-full h-full min-h-[100vh] flex flex-col bg-[#0a0a0c] overflow-hidden font-sans relative z-10", className)}>
      
      {/* Header: ตรึงนิ่งสนิทตามกฎ */}
      <header className="flex-none sticky top-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-white/10">
        <div className="p-4 xl:p-6 w-full">
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
          rightSidebar ? "w-full xl:w-[75%]" : "w-full"
        )}>
          {leftContent}
        </main>

        {/* ฝั่งขวา: แผงสรุปยอดเกาะติดหน้าจอ หรือเลื่อนแยกอิสระ */}
        {rightSidebar && (
          <aside className="w-full xl:w-[25%] flex-none border-t xl:border-t-0 xl:border-l border-white/10 bg-white/[0.02] overflow-y-auto custom-scrollbar">
            {rightSidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
