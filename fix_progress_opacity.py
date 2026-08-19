import glob
import re

files = glob.glob('src/app/(authenticated)/**/*.tsx', recursive=True)

# Colors we care about: nexus-teal, nexus-blue, emerald-500, warning, danger, white, black, #111111, #0a0a0c, etc.

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            c = f.read()

        changed = False

        # If a div has bg-transparent but has a text-color, let's restore it to color/15
        def repl(match):
            color = match.group(2) # e.g. nexus-teal
            # We want to replace bg-transparent with bg-{color}/15
            cls = match.group(0)
            if 'bg-transparent' in cls:
                return cls.replace('bg-transparent', f'bg-{color}/15')
            return cls

        # This will match <div className="... bg-transparent ... text-nexus-teal ...">
        new_c = re.sub(r'(className=\"[^\"]*bg-transparent[^\"]*text-(nexus-teal|nexus-blue|emerald-500|warning|danger)[^\"]*\")', repl, c)
        
        # Dashboard might have bg-white/5, bg-white/10, etc. Let's change them to bg-white/15
        new_c = re.sub(r'bg-white/5(?=[\s\"])', 'bg-white/15', new_c)
        new_c = re.sub(r'bg-white/10(?=[\s\"])', 'bg-white/15', new_c)
        
        # Change specific semi-transparent dark backgrounds
        new_c = re.sub(r'bg-black/40(?=[\s\"])', 'bg-black/15', new_c)
        new_c = re.sub(r'bg-black/20(?=[\s\"])', 'bg-black/15', new_c)
        new_c = re.sub(r'bg-\[\#0a0a0c\]/60', 'bg-[#0a0a0c]/15', new_c)
        new_c = re.sub(r'bg-\[\#0a0a0c\]/80', 'bg-[#0a0a0c]/15', new_c)
        new_c = re.sub(r'bg-black/60', 'bg-black/15', new_c)
        
        if c != new_c:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_c)
            print(f'Updated {file}')
    except Exception as e:
        print(f'Error processing {file}: {e}')
