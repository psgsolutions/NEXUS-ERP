const fs = require('fs');
let content = fs.readFileSync('src/app/(authenticated)/inventory/products/new/page.tsx', 'utf8');

const target = `                            </div>

                                newConvs[idx].price = val;
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
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button 
                      onClick={() => setFormData({ ...formData, conversions: [...formData.conversions, { toUnit: "", rate: 1, price: formData.price, barcode: "" }] })}
                      className="w-full h-8 flex items-center justify-center gap-2 border border-dashed border-nexus-teal/30 rounded-xl text-sm font-bold text-nexus-teal/70 hover:text-nexus-teal hover:border-nexus-teal/60 hover:bg-nexus-teal/5 transition-all mt-2"
                    >
                      <Plus size={14} /> เพิ่มหน่วยขายย่อย / Conversion
                    </button>`;

const replacement = `                            <div className="col-span-4 flex items-center gap-2">
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
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button 
                      onClick={() => {
                        const lastUnit = formData.conversions.length > 0 ? formData.conversions[formData.conversions.length - 1].toUnit : formData.baseUnit;
                        setFormData({ 
                          ...formData, 
                          conversions: [...formData.conversions, { toUnit: "", relativeRate: 1, relativeToUnit: lastUnit, rateToBase: 1, price: formData.price, barcode: "" }] 
                        });
                      }}
                      className="w-full h-10 flex items-center justify-center gap-2 border border-dashed border-nexus-teal/40 rounded-xl text-sm font-bold text-nexus-teal hover:text-white hover:border-nexus-teal hover:bg-nexus-teal/20 transition-all mt-2 shadow-[0_0_15px_rgba(20,184,166,0.1)]"
                    >
                      <Plus size={16} /> เพิ่มชั้นบรรจุภัณฑ์ที่ใหญ่ขึ้น
                    </button>`;

if(content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/app/(authenticated)/inventory/products/new/page.tsx', content);
  console.log("Replaced successfully!");
} else {
  console.log("Target string not found!");
}
