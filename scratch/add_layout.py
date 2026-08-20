with open('src/components/ui/Base.tsx', 'a', encoding='utf-8') as f:
    f.write('''

// [PSG-STANDARD-V3] Full Page Layout
export function NexusPageLayout({ header, leftContent, rightSidebar }: { header: React.ReactNode, leftContent: React.ReactNode, rightSidebar: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-[#050505] p-4 sm:p-6 gap-6 min-h-screen overflow-x-hidden">
      {header}
      <div className="flex flex-col xl:flex-row gap-6 relative items-start">
        <div className="flex-1 w-full xl:w-[75%] min-w-0">
          {leftContent}
        </div>
        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px]">
          {rightSidebar}
        </div>
      </div>
    </div>
  );
}
''')
