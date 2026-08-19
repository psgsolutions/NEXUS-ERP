import os
import re

modules = ["projects", "sales", "hr", "inventory", "procurement", "finance", "ai", "settings"]
base_dir = r"d:\NEXUS-ERP\src\app\(authenticated)"

for module in modules:
    path = os.path.join(base_dir, module, "page.tsx")
    if not os.path.exists(path):
        continue
        
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    print(f"\n--- {module}/page.tsx ---")
    for i, line in enumerate(lines):
        if "flex-col lg:flex-row" in line and "<div" in line:
            print(f"Row {i+1}: {line.strip()}")
        if "lg:w-[" in line or "xl:w-[" in line or "md:w-64" in line or "w-[25%]" in line or "w-[30%]" in line:
            # exclude some known non-layout classes
            if "w-[250px]" not in line and "w-10" not in line and "w-12" not in line:
                print(f"Col {i+1}: {line.strip()}")

