import os
import re

directory = r"d:\NEXUS-ERP\src\components\commerce"
pattern = re.compile(r'([\u0E00-\u0E7F0-9%A-Za-z]+\s*)\([A-Za-z\s/&.-]+\)')

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            matches = pattern.findall(content)
            if matches:
                print(f"File: {file}")
                # findall returns the groups if there are capturing groups.
                # To see the full match, let's use finditer
                for m in pattern.finditer(content):
                    print("  Match:", m.group(0))
