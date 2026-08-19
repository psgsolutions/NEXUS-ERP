import re
import os

target_modules = [
    "projects",
    "sales",
    "hr",
    "inventory",
    "procurement",
    "finance",
    "ai",
    "settings"
]

base_dir = r"d:\NEXUS-ERP\src\app\(authenticated)"

for module in target_modules:
    page_path = os.path.join(base_dir, module, "page.tsx")
    if not os.path.exists(page_path):
        print(f"File not found: {page_path}")
        continue
    
    with open(page_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Rule 1: <div className="flex flex-col lg:flex-row items-start gap-4"> or similar
    # becomes <div className="flex flex-col xl:flex-row gap-4">
    # Try to match variations
    content = re.sub(
        r'<div className="flex flex-col (?:lg|xl):flex-row(?: items-start)? gap-4(?: relative)?">',
        r'<div className="flex flex-col xl:flex-row gap-4">',
        content
    )

    # Replace specific left col wrapper if not standard
    # Should be <div className="flex-1 min-w-0">, might have space-y-* etc. No need to strictly touch unless requested.

    # Rule 2: Sidebar: <div className="lg:w-[25%] shrink-0 space-y-4 sticky top-[96px]">
    # becomes <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">
    # Match various existing patterns:
    # lg:w-[25%] or xl:w-[25%] with optional shrink-0, sticky, top-[96px], space-y-4
    # Instead of complex regex, let's look for standard patterns and replace them
    content = re.sub(
        r'className="lg:w-\[25%\][^"]*"',
        r'className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4"',
        content
    )
    content = re.sub(
        r'className="xl:w-\[25%\][^"]*"',
        r'className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4"',
        content
    )
    
    # Just to be safe, sometimes it might be lg:w-[30%] or similar? We only look for [25%] or maybe [30%]?
    # The user says "ปรับเรื่องการใช้การแบ่งสัดส่วน ซ้าย75 ขวา25 อย่างเคร่งครัด"
    # Wait, some pages might not have a sidebar yet. If so, they need a bigger refactor.
    # Let's save and see.
    with open(page_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated {module}/page.tsx")
