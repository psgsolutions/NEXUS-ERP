import sys

file_path = 'd:/NEXUS-ERP/src/app/(authenticated)/inventory/products/new/page.tsx'

with open(file_path, 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8')
if text.startswith('\ufeff'):
    text = text[1:]

original_bytes = text.encode('cp874')
true_text = original_bytes.decode('utf-8')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(true_text)
print("Recovered!")
