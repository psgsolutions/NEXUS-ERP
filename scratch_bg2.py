import glob
import re

files = glob.glob('src/app/(authenticated)/**/*.tsx', recursive=True)

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()

        changed = False

        new_c = re.sub(r'bg-nexus-teal/10', 'bg-transparent', c)
        new_c = re.sub(r'bg-nexus-blue/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-emerald-500/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-emerald-400/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-purple-500/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-amber-500/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-warning/10', 'bg-transparent', new_c)
        new_c = re.sub(r'bg-danger/10', 'bg-transparent', new_c)
        
        # Only replace white/5 if it's on an icon or chip. Actually, let's just replace all these specific ones:
        
        if c != new_c:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_c)
            print('Updated', file)
    except Exception as e:
        pass
