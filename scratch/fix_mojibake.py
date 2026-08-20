import re

def fix_mojibake(text):
    try:
        return text.encode('windows-1252').decode('tis-620')
    except Exception:
        pass
    try:
        return text.encode('latin1').decode('tis-620')
    except Exception:
        pass
    return text

with open('src/app/(authenticated)/procurement/requests/new/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Try to find sequences of Thai mojibake which are usually continuous Latin-1 characters
# Mojibake for Thai usually contains characters like 'เธšเธฃเธดเธฉเธฑเธ—' (all in Latin-1 upper half)
def replacer(match):
    bad_str = match.group(0)
    fixed = fix_mojibake(bad_str)
    return fixed

# Matches things inside quotes, or just manually fix the whole file?
# Let's just fix the whole file character by character where possible?
# Actually, the file has both CORRECT Thai and MOJIBAKE Thai!
# If a substring can be encoded to latin1 and decoded as tis-620 to produce valid Thai, we can replace it.
# Let's extract all strings in quotes:
import json

lines = content.splitlines()
for i, line in enumerate(lines):
    # simple naive replace for common mojibake patterns
    if 'เธ' in line or 'เน' in line:
        # find sequences of mojibake
        # A naive way is to use regex to find sequences of characters that are in the mojibake range
        # Thai mojibake starts with 'เ' which is \u0e40 in Thai, but in latin1 -> tis620 it's usually represented as 'เ' wait.
        # Let's just do a regex that matches sequences of characters that are successfully convertible.
        words = re.findall(r'[^\s<>]+', line)
        for w in words:
            if 'เธ' in w or 'เน' in w:
                fixed = fix_mojibake(w)
                if fixed != w:
                    line = line.replace(w, fixed)
        lines[i] = line

with open('src/app/(authenticated)/procurement/requests/new/page.tsx.fixed', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
