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
                # If we really can't encode it, just put the utf8 bytes of the char?
                bytes_list.extend(char.encode('utf-8'))
                
    # Now fix the dropped control bytes
    # e0 b8 20 -> e0 b8 81 (ก)
    # The LLM replaced 0x81, 0x8d, 0x8f, 0x90, 0x9d with 0x20 (space).
    # Since we can't be sure which one it was, but 'ก' (0x81) is extremely common, 
    # we'll assume e0 b8 20 is e0 b8 81 for now.
    
    # We can do a smart replace:
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
        return f"DECODE_ERROR: {e}, bytes: {[hex(b) for b in fixed_bytes]}"

# Test it
bad = 'เธšเธฃเธดเธฉเธฑเธ— เธญเธธเธ›เธ เธฃเธ“เนŒเน„เธญเธ—เธต เธˆเธณเธ เธฑเธ” (เธกเธซเธฒเธŠเธ™)'
fixed = reverse_mojibake(bad)
with open('scratch/out.txt', 'w', encoding='utf-8') as f:
    f.write(fixed)
