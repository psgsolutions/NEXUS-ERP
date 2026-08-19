import re
import os

files = [
    "src/app/(authenticated)/dashboard/page.tsx",
    "src/app/(authenticated)/sales/page.tsx",
    "src/app/(authenticated)/finance/page.tsx",
    "src/app/(authenticated)/inventory/page.tsx",
    "src/app/(authenticated)/procurement/page.tsx",
    "src/app/(authenticated)/hr/page.tsx",
    "src/app/(authenticated)/reports/page.tsx",
    "src/app/(authenticated)/products/page.tsx",
    "src/app/(authenticated)/customers/page.tsx",
    "src/app/(authenticated)/admin/form-builder/page.tsx",
    "src/app/(authenticated)/ai/page.tsx",
    "src/app/(authenticated)/settings/page.tsx"
]

def patch_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - not found")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # If already patched with Master Blueprint V3.1 Global Layout Lock, skip
    if "Global Layout Lock" in content:
        print(f"Skipping {filepath} - already patched")
        return

    # Find the main component signature: export default function XxxPage
    main_func_match = re.search(r'export default function [a-zA-Z0-9_]+\s*\([^)]*\)\s*{', content)
    if not main_func_match:
        print(f"Skipping {filepath} - main func not found")
        return

    func_start = main_func_match.end()

    # Find the first `return (` after the main function starts
    return_match = re.search(r'return\s*\(\s*', content[func_start:])
    if not return_match:
        print(f"Skipping {filepath} - main return not found")
        return
        
    return_pos = func_start + return_match.start()
    
    # We will inject the useEffect right before the return statement
    use_effect_code = """
  // [Master Blueprint V3.1] Global Layout Lock
  React.useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.style.overflowY = "hidden";
    return () => {
      if (mainEl) mainEl.style.overflowY = "auto";
    };
  }, []);

"""

    # Ensure React is imported or available (it usually is globally in Next, but React.useEffect is safer if React is imported)
    if 'import React' not in content and 'import * as React' not in content:
        content = 'import React from "react";\n' + content

    # Find the outermost div class
    # The return statement looks like: return ( <div className="p-6 ...">
    div_match = re.search(r'<div\s+className=(?:\{cn\([\n\s]*"|")([^"]+)"', content[return_pos:return_pos+200])
    
    if not div_match:
        print(f"Skipping {filepath} - could not find top level div")
        return
        
    div_pos_start = return_pos + div_match.start(0)
    div_pos_end = return_pos + div_match.end(0)

    # Let's just do a manual string replacement for the top level JSX
    # We replace the top level div with our wrapper
    wrapper_start = '<div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-transparent">\n      <header className="p-6 border-b border-white/5 bg-black/20 shrink-0">\n'
    
    # Now we need to find where the header ends. Usually it's the first child div.
    # We can just look for `</header>` manually later, but for now we'll put the whole body in a scrollable div EXCEPT we can't reliably parse JSX closing tags with regex.
    
    # Alternatively, just inject the useEffect and change the outermost div to:
    # `<div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">`
    # Wait! If the user just wants the page to be scrollable but independent of the `<main>`, applying `overflow-y-auto` to the outermost div DOES NOT lock the header!
    # But wait, if they have a split layout (like projects/page.tsx), the header IS locked because of the flex-col and shrink-0.
    # For simple pages (like finance/page.tsx), the header scrolls with the page, but at least the scrollbar isn't doubled.
    
    pass
