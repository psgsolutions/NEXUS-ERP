import React from 'react';

export default function NexusPageLayout({ 
  header, 
  leftContent, 
  rightSidebar,
  topContent 
}: { 
  header: React.ReactNode; 
  leftContent: React.ReactNode; 
  rightSidebar: React.ReactNode; 
  topContent?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full font-sans">
      {/* Header: ตรึงนิ่งสนิท */}
      <header className="sticky top-0 z-50 bg-[#0a0a0c]/90 backdrop-blur-md border-b border-white/5">
        {header}
      </header>

      {/* Optional Full-width Top Content */}
      {topContent && (
        <div className="px-4 xl:px-6 pt-6 w-full animate-in fade-in duration-700">
          {topContent}
        </div>
      )}

      {/* Main Container: แบ่ง Split Layout */}
      <div className="flex flex-col xl:flex-row gap-4 p-4 xl:p-6 w-full flex-1">
        {/* ฝั่งซ้าย: เนื้อหาหลัก */}
        <main className="w-full flex-1 pr-0 xl:pr-2 space-y-6 pb-24">
          {leftContent}
        </main>

        {/* ฝั่งขวา: คอลัมน์สรุป เกาะติดหน้าจอ 25% */}
        <aside className="w-full xl:w-[25%] shrink-0 sticky top-[96px] max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar pb-10">
          {rightSidebar}
        </aside>
      </div>
    </div>
  );
}
