import re
with open('src/components/ui/Base.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

matches = re.finditer(r'className=\{\s*cn\(\s*\"([^\"]*bg-[^\"]*)\"', c)
for m in matches:
    cls = m.group(1)
    if 'bg-transparent' not in cls and 'bg-white/0' not in cls:
        print('CN:', cls)

matches = re.finditer(r'className=\"([^\"]*bg-[^\"]*)\"', c)
for m in matches:
    cls = m.group(1)
    if 'bg-transparent' not in cls and 'bg-white/0' not in cls:
        print('STR:', cls)
