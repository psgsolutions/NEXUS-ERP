import os

files_to_fix = [
    r"d:\NEXUS-ERP\src\app\(authenticated)\projects\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\hr\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\procurement\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\ai\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\settings\page.tsx"
]

sidebar_code = """
          <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">
              <h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
                ภาพรวม
              </h3>
              <div className="flex flex-col items-center justify-center py-8 text-white/20">
                <p className="text-sm font-black uppercase tracking-widest">ยังไม่มีข้อมูลสรุป</p>
              </div>
            </div>
            
            <div className="p-4 border-t border-white/5 bg-black/10 flex items-center justify-between text-xs text-white/30 font-bold rounded-3xl">
              <span>NEXUS Real-time Engine</span>
              <span>PSG V3.1</span>
            </div>
          </div>
"""

for filepath in files_to_fix:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # We need to find: <div className="flex-1 min-w-0
    # Then find its matching closing </div>
    # Then insert sidebar_code after that </div>
    
    start_idx = content.find('<div className="flex-1 min-w-0')
    if start_idx == -1:
        print(f"Could not find left column in {filepath}")
        continue
        
    # find matching closing div
    i = start_idx
    div_count = 0
    in_div = False
    closing_idx = -1
    
    while i < len(content):
        if content[i:i+4] == '<div':
            div_count += 1
            in_div = True
        elif content[i:i+6] == '</div>':
            div_count -= 1
            if in_div and div_count == 0:
                closing_idx = i + 6
                break
        i += 1
        
    if closing_idx != -1:
        # Check if the next tag is already the sidebar (just in case)
        next_content = content[closing_idx:closing_idx+100]
        if "xl:w-[25%]" in next_content:
            print(f"Sidebar already exists in {filepath}")
            continue
            
        new_content = content[:closing_idx] + "\n" + sidebar_code + content[closing_idx:]
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Added sidebar to {filepath}")
    else:
        print(f"Could not find matching closing div in {filepath}")

