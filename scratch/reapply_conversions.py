import sys

file_path = 'd:/NEXUS-ERP/src/app/(authenticated)/inventory/products/new/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Locate where to insert the conversions list
target = '''                  {/* Base Unit */}
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                    <Field label="หน่วยหลัก (Base Unit) *หน่วยย่อยที่สุด ที่ใช้ตัดสต๊อก">
                      <SmartComboBox 
                        options={uomOptions} 
                        value={formData.baseUnit} 
                        onChange={(val) => setFormData({...formData, baseUnit: val})} 
                        className="w-full h-9 px-6 pr-10 rounded-full text-center font-bold text-nexus-teal"
                        placeholder="เลือกหรือพิมพ์หน่วย..."
                      />
                    </Field>
                  </div>'''

conversions_ui = '''
                  {/* Conversions List */}
                  {formData.conversions.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {formData.conversions.map((conv, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 bg-white/[0.02] p-3 rounded-xl border border-white/5 items-end relative group">
                          <button onClick={() => {
                            const newConvs = [...formData.conversions];
                            newConvs.splice(idx, 1);
                            setFormData({ ...formData, conversions: newConvs });
                          }} className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-danger/20 border border-danger/30 text-danger flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-danger hover:text-white" title="ลบหน่วยนี้">
                            <Trash2 size={10} />
                          </button>

                          <div className="col-span-3">
                            <label className="text-[9px] text-white/40 uppercase mb-1 block font-black">1. กำหนดหน่วย</label>
                            <SmartComboBox 
                              options={uomOptions} 
                              value={conv.toUnit} 
                              onChange={(val) => {
                                const newConvs = [...formData.conversions];
                                newConvs[idx].toUnit = val;
                                setFormData({ ...formData, conversions: newConvs });
                              }} 
                              className="w-full h-8 px-4 pr-8 rounded-full text-[11px] font-bold text-nexus-teal"
                              placeholder="หน่วย..."
                            />
                          </div>

                          <div className="col-span-3">
                            <label className="text-[9px] text-white/40 uppercase mb-1 block font-black">2. = กี่ {formData.baseUnit}?</label>
                            <StepperInput value={conv.rate} onChange={(val) => {
                              const newConvs = [...formData.conversions];
                              newConvs[idx].rate = val;
                              setFormData({ ...formData, conversions: newConvs });
                            }} className="h-8 text-[11px] text-nexus-teal" />
                          </div>

                          <div className="col-span-3">
                            <label className="text-[9px] text-white/40 uppercase mb-1 block font-black">3. ราคาขายต่อหน่วย</label>
                            <StepperInput value={conv.price} onChange={(val) => {
                              const newConvs = [...formData.conversions];
                              newConvs[idx].price = val;
                              setFormData({ ...formData, conversions: newConvs });
                            }} className="h-8 text-[11px] text-nexus-teal" />
                          </div>

                          <div className="col-span-3">
                            <label className="text-[9px] text-white/40 uppercase mb-1 block font-black">4. บาร์โค้ด (ถ้ามี)</label>
                            <PillInput value={conv.barcode} onChange={(e) => {
                              const newConvs = [...formData.conversions];
                              newConvs[idx].barcode = e.target.value;
                              setFormData({ ...formData, conversions: newConvs });
                            }} placeholder="SCAN" className="w-full h-8 px-3 rounded-full text-[10px] text-center" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    onClick={() => setFormData({ ...formData, conversions: [...formData.conversions, { toUnit: "", rate: 1, price: formData.price, barcode: "" }] })}
                    className="w-full h-9 flex items-center justify-center gap-2 border border-dashed border-nexus-teal/30 rounded-xl text-[10px] font-bold text-nexus-teal/70 hover:text-nexus-teal hover:border-nexus-teal/60 hover:bg-nexus-teal/5 transition-all mt-2"
                  >
                    <Plus size={14} /> เพิ่มหน่วยนับย่อย / Conversion
                  </button>
'''

if 'Conversions List' not in content:
    content = content.replace(target, target + conversions_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied conversions UI")
