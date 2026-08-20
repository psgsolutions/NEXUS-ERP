import os

filepath = 'src/app/(authenticated)/procurement/requests/new/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                whtRate === rate 
              {rate === 0 ? "ไม่หัก WHT" : `WHT ${rate}%`}
                  : "bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/60"'''

replacement = '''                whtRate === rate 
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  : "bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/60"'''

content = content.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
