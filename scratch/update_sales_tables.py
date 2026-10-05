import sys
import re

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# For CustomerRow
content = content.replace(
    'className="w-[120px] font-mono text-[13px] text-nexus-blue font-medium tracking-tighter"',
    'className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-nexus-blue font-medium tracking-tighter"'
)
content = content.replace(
    'className="font-bold text-white/80 group-hover:text-white transition-colors"',
    'className="font-bold text-white/80 group-hover:text-white transition-colors w-full"'
)
content = content.replace(
    'className="w-[160px] text-[13px] font-medium text-white/60"',
    'className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/60"'
)
content = content.replace(
    'className="w-[160px] font-mono text-xs text-white/30 text-left"',
    'className="w-[1%] whitespace-nowrap text-center font-mono text-xs text-white/30"'
)
content = content.replace(
    'className="text-center w-[100px]"',
    'className="w-[1%] whitespace-nowrap text-center"'
)
content = content.replace(
    'className="w-[80px] text-right"',
    'className="w-[1%] whitespace-nowrap text-center"'
)

# For QuotationRow
content = content.replace(
    'className="w-[140px] text-nexus-teal tracking-tighter"',
    'className="w-[1%] whitespace-nowrap align-middle text-center text-nexus-teal tracking-tighter"'
)
content = content.replace(
    'className="font-bold text-white/80"',
    'className="font-bold text-white/80 w-full"'
)
content = content.replace(
    'className="text-[14px] font-bold text-white/40 whitespace-nowrap"',
    'className="w-[1%] whitespace-nowrap text-[14px] font-bold text-white/40 text-center"'
)
content = content.replace(
    'className="w-[150px] text-right text-white"',
    'className="w-[1%] whitespace-nowrap text-right text-white"'
)
content = content.replace(
    'className="text-center w-[140px]"',
    'className="w-[1%] whitespace-nowrap text-center"'
)
content = content.replace(
    'className="w-[100px] text-right"',
    'className="w-[1%] whitespace-nowrap text-center"'
)

# For SalesOrderRow
content = content.replace(
    'className="w-[140px] font-mono text-[13px] text-nexus-blue font-medium tracking-tighter"',
    'className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-nexus-blue font-medium tracking-tighter"'
)
content = content.replace(
    'className="w-[180px] text-[13px] font-medium text-white/40 uppercase tracking-widest"',
    'className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/40 uppercase tracking-widest"'
)

# For InvoiceRow
content = content.replace(
    'className="w-[140px] font-mono text-[13px] text-white/40"',
    'className="w-[1%] whitespace-nowrap text-center font-mono text-[13px] text-white/40"'
)
content = content.replace(
    'className="w-[120px] text-[13px] font-medium text-white/40"',
    'className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-white/40"'
)
content = content.replace(
    'className="w-[120px] text-[13px] font-medium text-warning"',
    'className="w-[1%] whitespace-nowrap text-center text-[13px] font-medium text-warning"'
)
content = content.replace(
    'className="text-center w-[120px]"',
    'className="w-[1%] whitespace-nowrap text-center"'
)

# For BillingNoteRow
content = content.replace(
    'className="w-[140px] font-mono text-[13px] text-warning font-medium tracking-tighter"',
    'className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-warning font-medium tracking-tighter"'
)

# For CndnRow
content = content.replace(
    'className="w-[100px] font-bold text-[11px] uppercase tracking-widest text-white/40"',
    'className="w-[1%] whitespace-nowrap text-center font-bold text-[11px] uppercase tracking-widest text-white/40"'
)

# For ReceiptRow
content = content.replace(
    'className="w-[140px] font-mono text-[13px] text-emerald-400 font-medium tracking-tighter"',
    'className="w-[1%] whitespace-nowrap align-middle text-center font-mono text-[13px] text-emerald-400 font-medium tracking-tighter"'
)
content = content.replace(
    'className="w-[150px] text-right text-emerald-400"',
    'className="w-[1%] whitespace-nowrap text-right text-emerald-400"'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
