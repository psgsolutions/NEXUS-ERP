import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure to import DocumentHeader
if 'from "@/components/document/DocumentHeader"' not in content:
    content = content.replace(
        'import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";',
        'import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";\nimport { DocumentHeader } from "@/components/document/DocumentHeader";'
    )

start_marker = '{/* Customer and Dates */}'
end_marker = '{/* Line Items Table */}'

if start_marker in content and end_marker in content:
    before = content.split(start_marker)[0]
    after = end_marker + content.split(end_marker)[1]
    
    new_header = '''<DocumentHeader 
        docNo="QT-2026-08-001"
        issueDate={docDate}
        dueDate={validUntil}
        customerName={customer ? customer.name : ""}
        phone="02-123-4567"
        email="contact@example.com"
        creditTerms="30 Days"
        deliveryDate={validUntil}
        onDocNoChange={() => {}}
        onCustomerSelect={() => setIsCustomerSelectorOpen(!isCustomerSelectorOpen)}
      />
      
      {isCustomerSelectorOpen && (
        <div className="absolute top-[250px] left-[40px] w-[400px] bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl p-2 z-50">
          {MOCK_CUSTOMERS.map(c => (
            <div 
              key={c.id} 
              onClick={() => { setSelectedCustomer(c.id); setIsCustomerSelectorOpen(false); }}
              className="p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all"
            >
              <p className="text-[13px] font-bold text-white">{c.name}</p>
              <p className="text-[10px] text-white/30 mt-1 font-mono">{c.taxId} • <span className="font-sans">{c.address}</span></p>
            </div>
          ))}
          <div className="p-3 mt-2 border-t border-white/5 hover:bg-cyan-500/10 rounded-lg cursor-pointer text-cyan-400 flex items-center gap-2">
            <Plus size={14} /> <span className="text-[13px] font-bold">เพิ่มลูกค้าใหม่...</span>
          </div>
        </div>
      )}

      '''
    
    content = before + new_header + after

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
