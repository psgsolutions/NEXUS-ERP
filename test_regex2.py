import os
import re

directory = r"d:\NEXUS-ERP\src\components\commerce"
# Match something like:
# > ... Thai characters ... (English Text) ... <
# We want to replace the (English Text) with nothing, keeping the rest intact.
# Using a function to replace only the matched group.
pattern = re.compile(r'(>.*?(?:[\u0E00-\u0E7F]+).*?)\s*\([A-Za-z\s/&.-]+\)(.*?<)')

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            def replace_func(m):
                # m.group(1) is everything from > up to just before the (
                # m.group(2) is everything after the ) up to <
                return m.group(1) + m.group(2)

            new_content = pattern.sub(replace_func, content)
            # wait, if there are multiple parentheses in the same tag, pattern.sub might need to run multiple times, or we just do it once if there's only one.
            
            if new_content != content:
                print(f"File: {file}")
                # let's just print a diff-like or what we found
                for m in pattern.finditer(content):
                    print("  Match:", m.group(0))
