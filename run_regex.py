import os
import re

directory = r"d:\NEXUS-ERP\src\components\commerce"
# Match something like:
# > ... Thai characters ... (English Text) ... <
pattern = re.compile(r'(>.*?(?:[\u0E00-\u0E7F]+).*?)\s*\([A-Za-z\s/&.-]+\)(.*?<)')

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            def replace_func(m):
                return m.group(1) + m.group(2)

            # We need to run it multiple times if there are multiple tags in a line, 
            # but sub automatically replaces all non-overlapping occurrences.
            new_content = pattern.sub(replace_func, content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {file}")
