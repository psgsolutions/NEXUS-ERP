$path = 'd:\NEXUS-ERP\src\app\(authenticated)\inventory\products\new\page.tsx'
$content = Get-Content $path -Raw

# Replace LF with CRLF just in case
$content = $content -replace "`r`n", "`n"

$target = '<PillSelect value={conv.toUnit} onChange={(e) => {
                              const newConvs = [...formData.conversions];
                              newConvs[idx].toUnit = e.target.value;
                              setFormData({ ...formData, conversions: newConvs });
                            }} className="w-full h-8 px-4 rounded-full text-[11px]">
                              {uomOptions.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                            </PillSelect>'

$replacement = '<SmartComboBox 
                              options={uomOptions} 
                              value={conv.toUnit} 
                              onChange={(val) => {
                                const newConvs = [...formData.conversions];
                                newConvs[idx].toUnit = val;
                                setFormData({ ...formData, conversions: newConvs });
                              }} 
                              className="h-8 text-[11px] font-bold"
                              placeholder="หน่วย..."
                            />'

$content = $content.Replace($target, $replacement)

Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8
Write-Output "Done"
