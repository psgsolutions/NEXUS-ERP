import re
import os

filepath = 'src/app/(authenticated)/projects/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the return block
old_return_start = '''  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">

      {/* Compact Module Header — icon + title + inline metric chips on same plane */}'''

new_return_start = '''  const headerContent = (
    <div className="flex-1 w-full">
      {/* Compact Module Header — icon + title + inline metric chips on same plane */}'''

content = content.replace(old_return_start, new_return_start)

# We need to find the end of the header
header_end = '''      </header>'''
new_header_end = '''      </header>
    </div>
  );

  const leftContent = (
    <div className="flex-1 flex flex-col h-full bg-transparent">'''

content = content.replace(header_end, new_header_end, 1)

# Now find the end of the file
old_eof = '''        )}
      </div>
      </div>
    </div>
  );
}'''

new_eof = '''        )}
      </div>
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="p-6 space-y-6">
      <h3 className="text-sm font-black text-white/80 uppercase tracking-widest">ข้อมูลโดยสรุป</h3>
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-xs text-white/40 uppercase mb-1">สถานะโครงการ</p>
          <p className="text-lg font-bold text-nexus-teal">รอตรวจสอบ</p>
        </div>
      </div>
    </div>
  );

  return (
    <NexusPageLayout 
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}'''

content = content.replace(old_eof, new_eof)

# Make sure NexusPageLayout is imported
if 'NexusPageLayout' not in content:
    content = content.replace('import { \n  PillButton,', 'import NexusPageLayout from "@/components/layout/NexusPageLayout";\nimport { \n  PillButton,')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactored projects/page.tsx to use NexusPageLayout")
