import sys
import re

file_path = 'd:/NEXUS-ERP/src/app/(authenticated)/inventory/products/new/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = r'''                            <PillSelect value={conv.toUnit} onChange={(e) => {
                              const newConvs = [...formData.conversions];
                              newConvs[idx].toUnit = e.target.value;
                              setFormData({ ...formData, conversions: newConvs });
                            }} className="w-full h-8 px-4 rounded-full text-[11px]">
                              {uomOptions.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                            </PillSelect>'''

# Escape regex characters
target = re.escape(target)
# Make spaces flexible
target = target.replace(r'\ ', r'\s*').replace(r'\n', r'\s*')

replacement = '''                            <SmartComboBox 
                              options={uomOptions} 
                              value={conv.toUnit} 
                              onChange={(val) => {
                                const newConvs = [...formData.conversions];
                                newConvs[idx].toUnit = val;
                                setFormData({ ...formData, conversions: newConvs });
                              }} 
                              className="h-8 text-[11px] font-bold"
                              placeholder="หน่วย..."
                            />'''

new_content = re.sub(target, replacement, content, flags=re.MULTILINE)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Done")
