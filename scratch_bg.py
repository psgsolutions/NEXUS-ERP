import glob
import re

files = glob.glob('src/app/(authenticated)/**/*.tsx', recursive=True)

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()

        changed = False

        # Find header blocks and replace backgrounds
        # E.g., bg-nexus-teal/10 -> bg-transparent
        # bg-black/40 -> bg-transparent
        # We can just look for classNames and replace known background colors
        
        # Replace main icon background
        new_c = re.sub(r'bg-nexus-teal/10', 'bg-transparent', c)
        new_c = re.sub(r'bg-nexus-blue/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-emerald-500/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-emerald-400/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-purple-500/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-amber-500/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-warning/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-danger/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-white/5', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-white/10', 'bg-transparent', new_c)

        # Replace chip backgrounds
        new_c = re.sub(r'bg-black/40', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-black/20', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-black/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-\[\#0A0A0A\]', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-\[\#111111\]', 'bg-transparent', new_c)
        
        # We shouldn't remove ALL bg-black because some structural elements might need it? 
        # But user said "ทุกไอค่อน ที่มีพื้นหลังทึบ"
        
        if c != new_c:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_c)
            print(f'Updated {file}')
    except Exception as e:
        print(f'Error: {e}')
