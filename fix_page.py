import sys

try:
    with open(r'd:\NEXUS-ERP\src\app\(authenticated)\inventory\products\new\page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix UI component
    bad_ui = '''                                newConvs[idx].price = val;
                                setFormData({ ...formData, conversions: newConvs });
                              }} className="h-8 text-sm text-nexus-teal text-center" />
                            </div>

                            <div className="col-span-3">
                              <label className="text-sm text-white/40 uppercase mb-1 block font-black">4. บาร์โค้ด</label>
                              <PillInput value={conv.barcode} onChange={(e) => {
                                const newConvs = [...formData.conversions];
                                newConvs[idx].barcode = e.target.value;
                                setFormData({ ...formData, conversions: newConvs });
                              }} placeholder="SCAN" className="w-full h-8 px-3 rounded-full text-sm text-center text-nexus-teal" />
                            </div>'''

    good_ui = '''                            <div className="col-span-4 flex items-center gap-2">
                              <div className="flex-1">
                                <label className="text-xs text-white/40 uppercase mb-1.5 block font-black">ประกอบด้วย</label>
                                <StepperInput value={conv.relativeRate} onChange={(val) => {
                                  const newConvs = [...formData.conversions];
                                  newConvs[idx].relativeRate = val;
                                  setFormData({ ...formData, conversions: newConvs });
                                }} className="h-9 text-sm text-nexus-teal text-center bg-black/20" />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-white/40 uppercase mb-1.5 block font-black">หน่วยอ้างอิง</label>
                                <select 
                                  value={conv.relativeToUnit} 
                                  onChange={(e) => {
                                    const newConvs = [...formData.conversions];
                                    newConvs[idx].relativeToUnit = e.target.value;
                                    setFormData({ ...formData, conversions: newConvs });
                                  }}
                                  className="w-full h-9 rounded-xl bg-black/40 border border-white/5 text-sm font-bold text-white px-2 focus:outline-none focus:border-nexus-teal/50"
                                >
                                  {availableParentUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>

                            <div className="col-span-3">
                              <label className="text-xs text-white/40 uppercase mb-1.5 block font-black">บาร์โค้ดประจำหน่วย</label>
                              <PillInput value={conv.barcode} onChange={(e) => {
                                const newConvs = [...formData.conversions];
                                newConvs[idx].barcode = e.target.value;
                                setFormData({ ...formData, conversions: newConvs });
                              }} placeholder="SCAN" className="w-full h-9 px-3 rounded-xl text-sm text-center text-nexus-teal bg-black/20 font-mono" />
                            </div>

                            <div className="col-span-2 flex flex-col justify-end h-full pt-6">
                              <div className="flex items-center justify-end h-9 px-2 bg-nexus-teal/10 rounded-xl border border-nexus-teal/20">
                                <span className="text-[10px] text-nexus-teal/60 uppercase font-black mr-1">=</span>
                                <span className="text-sm font-black text-nexus-teal">{calculatedRateToBase.toLocaleString()} <span className="text-[10px] text-nexus-teal/60">{formData.baseUnit}</span></span>
                              </div>
                            </div>'''

    if bad_ui in content:
        content = content.replace(bad_ui, good_ui)
        print('Fixed UI component!')
    else:
        print('UI component already fixed or not found.')

    # Fix handleSubmit payload
    target_payload = '''            isSerialized: formData.isSerialized,
            specifications: formData.specifications,
            manufacturerWarranty: formData.manufacturerWarranty,'''

    replacement_payload = '''            isSerialized: formData.isSerialized,
            specifications: formData.specifications,
            conversions: formData.conversions,
            manufacturerWarranty: formData.manufacturerWarranty,'''

    if target_payload in content:
        content = content.replace(target_payload, replacement_payload)
        print('Fixed handleSubmit payload!')
    else:
        print('handleSubmit payload already fixed or not found.')

    with open(r'd:\NEXUS-ERP\src\app\(authenticated)\inventory\products\new\page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

except Exception as e:
    print('Error:', e)
