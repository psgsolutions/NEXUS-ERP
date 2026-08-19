import os
import re

def standardize():
    target_dir = r"d:\NEXUS-ERP\src\app\(authenticated)"
    
    # We want to match the section that immediately wraps PillTabs
    section_pattern = re.compile(r'<section\s+className="([^"]*bg-black/10[^"]*border-b[^"]*)"\s*>')
    
    count = 0
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith("page.tsx") or file.endswith("_page.tsx"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                
                if "<PillTabs" in content:
                    def replacer(match):
                        classes = match.group(1)
                        if "bg-black/10" in classes and "border-b" in classes:
                            # Use py-2 and standardize flex wrapper
                            return '<section className="px-6 py-2 bg-black/10 border-b border-white/5 shrink-0 flex flex-col lg:flex-row items-center justify-between gap-4">'
                        return match.group(0)
                        
                    new_content = section_pattern.sub(replacer, content)
                    
                    if new_content != content:
                        with open(filepath, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        print(f"Updated: {filepath}")
                        count += 1

    print(f"Total updated: {count}")

if __name__ == "__main__":
    standardize()
