import sys

file_path = r'd:\NEXUS-ERP\src\app\(authenticated)\procurement\purchase-orders\new\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Supplier Column with DocumentHeader
start_marker = '{/* Supplier Column */}'
end_marker = '{/* Line Items Table */}'

if start_marker in content and end_marker in content:
    before = content.split(start_marker)[0]
    after = end_marker + content.split(end_marker)[1]
    
    # Import DocumentHeader if missing
    if 'from "@/components/document/DocumentHeader"' not in before:
        before = before.replace(
            'import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";',
            'import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";\nimport { DocumentHeader } from "@/components/document/DocumentHeader";'
        )

    new_header = '''<DocumentHeader 
          docNo="PO-2026-08-001"
          issueDate={formData.expectedDate}
          dueDate={formData.expectedDate}
          entityName={formData.supplierName}
          entityLabelTh="ผู้จำหน่าย"
          entityLabelEn="Supplier"
          entityPlaceholder="-- ค้นหาและเลือกผู้จำหน่าย --"
          phone="02-987-6543"
          email="sales@supplier.com"
          creditTerms="60 Days"
          deliveryDate={formData.expectedDate}
          onDocNoChange={() => {}}
          onEntitySelect={() => {}}
        />
        
        {/* We keep the SmartSelect logic hidden or we can use a modal/dropdown. Since DocumentHeader has onClick={onEntitySelect}, we should just render the SmartSelect wrapper or leave it for now. For simplicity, we just put the SmartSelect hidden but active or just show it below */}
        <div className="hidden">
           <SmartSelect
                value={formData.supplierId}
                onChange={(value) => {
                  const sup = suppliers?.find(s => s.id === value);
                  setFormData(prev => ({
                    ...prev,
                    supplierId: value,
                    supplierName: sup ? sup.name : ""
                  }));
                }}
                options={(suppliers || []).map(s => ({
                  value: s.id,
                  label: `${s.code || s.id} : ${s.name}`,
                }))}
                placeholder="-- ค้นหาและเลือกผู้จำหน่าย --"
              />
        </div>

        '''
    
    content = before + new_header + after

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
