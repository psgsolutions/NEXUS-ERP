import os

files = [
    r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\hr\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\procurement\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\finance\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\inventory\page.tsx",
    r"d:\NEXUS-ERP\src\app\(authenticated)\projects\page.tsx"
]

for filepath in files:
    if not os.path.exists(filepath):
        print(f"Not found: {filepath}")
        continue
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # The user specifically mentioned the right column cards.
    # Often they are like:
    # <GlassCard className="p-4 border-white/10 bg-nexus-blue/5">
    # <GlassCard className="p-4 border-white/10 bg-nexus-teal/5 rounded-lg">
    # <GlassCard className="p-4 border-white/10">

    # Let's replace the right-column cards (those after xl:w-[25%])
    # A safe way is to replace `<GlassCard className="p-4 border-white/10 bg-nexus-blue/5">`
    # and `<GlassCard className="p-4 border-white/10 bg-nexus-teal/5">`
    # with `<div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">`
    
    import re
    # Match the sticky column definition
    parts = content.split("w-full xl:w-[25%] shrink-0 sticky top-[96px]")
    if len(parts) > 1:
        right_col = parts[1]
        
        # In the right col, replace <GlassCard className="..."> with standard div
        # But wait, it has closing tags </GlassCard>
        # So it's easier to just strip out the bg-nexus-* classes and replace with normal styling
        # Or replace `<GlassCard ...>` with `<div ...>` and `</GlassCard>` with `</div>` only in right_col
        
        # Actually, if we just remove the colored backgrounds from the GlassCards in the right col:
        right_col = re.sub(r'bg-nexus-\w+/[0-9]+', '', right_col)
        
        # Remove animate-pulse on icons in the right col to be completely safe about "flashing"
        right_col = right_col.replace(' animate-pulse', '')
        
        # Let's also ensure they don't have weird border colors
        right_col = right_col.replace('border-white/10', 'border-white/5')
        
        # Rejoin
        content = parts[0] + "w-full xl:w-[25%] shrink-0 sticky top-[96px]" + right_col

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        print(f"Patched {os.path.basename(filepath)}")
