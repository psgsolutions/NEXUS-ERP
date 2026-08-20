import re

def reverse_mojibake(text):
    bytes_list = bytearray()
    for char in text:
        code = ord(char)
        if 0x0E00 <= code <= 0x0E7F:
            b = code - 0x0E00 + 0xA0
            bytes_list.append(b)
        else:
            try:
                b = char.encode('windows-1252')[0]
                bytes_list.append(b)
            except Exception:
                bytes_list.extend(char.encode('utf-8'))
                
    fixed_bytes = bytearray()
    i = 0
    while i < len(bytes_list):
        if i + 2 < len(bytes_list) and bytes_list[i] == 0xe0 and bytes_list[i+1] in (0xb8, 0xb9) and bytes_list[i+2] == 0x20:
            fixed_bytes.append(bytes_list[i])
            fixed_bytes.append(bytes_list[i+1])
            fixed_bytes.append(0x81)  # Assume 'ก'
            i += 3
        else:
            fixed_bytes.append(bytes_list[i])
            i += 1
            
    try:
        return fixed_bytes.decode('utf-8')
    except Exception as e:
        return text # fallback to original if decoding fails

with open('src/app/(authenticated)/procurement/requests/new/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find words/phrases that consist mostly of mojibake characters
# Thai mojibake characters are in the Thai block.
# Since the LLM output may include valid English mixed with mojibake, we can just find any sequence of
# Thai characters and spaces, and try to decode them.
# Even better: if a string has 'เธ' or 'เน', it's definitely our mojibake.

def replacer(match):
    original = match.group(0)
    fixed = reverse_mojibake(original)
    return fixed

# Match sequences of Thai characters, spaces, and English punctuation that might be part of the mojibake.
# Actually, since reverse_mojibake only modifies characters in the Thai block and valid windows-1252 mapped characters,
# and leaves others alone, we can apply it to anything between quotes, or we can just apply it to the whole line
# if the line contains 'เธ'.

lines = content.splitlines()
for i, line in enumerate(lines):
    if 'เธ' in line or 'เน' in line:
        # Instead of parsing everything, let's just find sequences of characters that have Thai in them.
        # This regex matches any word containing Thai chars (0E00-0E7F) and optionally surrounding chars.
        # But wait, LLM mojibake could also include English letters!
        # Let's apply to the text inside JSX text or quotes.
        # A simpler way: we can just split by quote/jsx tags or just apply it to words containing Thai.
        words = re.findall(r'[\u0E00-\u0E7F\w\s\(\)\.\-\,\:]+', line)
        for w in words:
            if 'เธ' in w or 'เน' in w:
                fixed = reverse_mojibake(w)
                if fixed != w:
                    line = line.replace(w, fixed)
        lines[i] = line

with open('src/app/(authenticated)/procurement/requests/new/page.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
