import os
import re

auth_dir = r"d:\NEXUS-ERP\src\app\(authenticated)"
modules = [d for d in os.listdir(auth_dir) if os.path.isdir(os.path.join(auth_dir, d))]

output_md = "# NEXUS ERP - Modules Analysis Report\n\n"

for module in sorted(modules):
    page_file = os.path.join(auth_dir, module, "page.tsx")
    if not os.path.exists(page_file):
        continue
    
    with open(page_file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    output_md += f"## Module: `{module}`\n\n"
    
    # Try to find tabs
    tabs_match = re.search(r'const tabs = \[(.*?)\];', content, re.DOTALL)
    submenus = []
    if tabs_match:
        tabs_str = tabs_match.group(1)
        labels = re.findall(r'label:\s*["\']([^"\']+)["\']', tabs_str)
        submenus = labels
    
    output_md += f"**Sub-menus / Tabs:** {', '.join(submenus) if submenus else 'None or custom'}\n\n"
    
    # Try to find data hooks (useRealtimeCollection, etc)
    collections = re.findall(r'collection\(db,\s*`companies/\${companyId}/([^`]+)`\)', content)
    output_md += f"**Data Used (Collections):** {', '.join(set(collections)) if collections else 'N/A'}\n\n"
    
    # Try to extract module title
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', content, re.DOTALL)
    if title_match:
        # cleanup tags
        title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()
        output_md += f"**UI Title:** {title}\n\n"
        
    output_md += "---\n\n"

with open(r"d:\NEXUS-ERP\scratch\modules_extract.md", 'w', encoding='utf-8') as f:
    f.write(output_md)
print("Extracted to scratch/modules_extract.md")
