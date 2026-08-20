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
        # return the error so we can see it in output!
        return f"ERR[{e}]"

with open('src/app/(authenticated)/procurement/requests/new/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# To be safer, let's just find anything between quotes that has Thai in it, OR any sequence of Thai characters.
# Actually, the most robust way is to just apply it to any continuous block of non-ASCII characters that look like Thai.
# But mojibake also contains spaces and punctuation!
# Let's extract strings between double or single quotes.
import json
lines = content.splitlines()
for i, line in enumerate(lines):
    if 'เธ' in line or 'เน' in line:
        # Instead of regex, let's just run it on the whole line!
        # Because reverse_mojibake will just pass ASCII characters through! 
        # Wait, ASCII characters like ' ' will be passed through to bytes.
        # ord(' ') is 32. 32 encodes to \x20 in windows-1252.
        # The bytes sequence will be correct!
        # Let's try reversing the WHOLE line!
        fixed_line = reverse_mojibake(line)
        if not fixed_line.startswith("ERR["):
            lines[i] = fixed_line
        else:
            print("Failed line:", i+1, fixed_line)

with open('scratch/fixed_file.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
