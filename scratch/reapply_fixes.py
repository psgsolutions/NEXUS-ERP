import sys
import re

file_path = 'd:/NEXUS-ERP/src/app/(authenticated)/inventory/products/new/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Image aspect ratio 1:1
content = content.replace('className="w-full aspect-video', 'className="w-full aspect-square')

# 2. Fix labels to be larger by 1 size and aligned, comments absolute
# We will replace Field component wrapper to make label flex-col but we don't have a Field wrapper in this file.
# The user said "label กับช่องกรอกเป็นบรรทัดฐานที่ให้ระดับเดียวกัน conment ให้เป็นส่วนเสริมไม่นับรวมเป็นบรรทัด"
# Oh wait, there is a Field component in page.tsx!
if 'const Field = ({ label, children, comment' in content:
    field_old = '''const Field = ({ label, children, comment, required = false }: { label: string, children: React.ReactNode, comment?: string, required?: boolean }) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex justify-between items-center px-2">
        <span>{label} {required && <span className="text-danger">*</span>}</span>
        {comment && <span className="text-[9px] text-white/20 font-bold tracking-normal normal-case">{comment}</span>}
      </label>
      {children}
    </div>
  );'''
    
    field_new = '''const Field = ({ label, children, comment, required = false }: { label: string, children: React.ReactNode, comment?: string, required?: boolean }) => (
    <div className="space-y-1.5 relative">
      <label className="text-[11px] font-black text-white/40 uppercase tracking-widest flex items-center px-2">
        <span>{label} {required && <span className="text-danger">*</span>}</span>
      </label>
      {children}
      {comment && <span className="absolute -bottom-4 right-2 text-[9px] text-white/20 font-bold tracking-normal normal-case">{comment}</span>}
    </div>
  );'''
    content = content.replace(field_old, field_new)

# 3. Increase label size for specific ones that are not in Field
content = content.replace('text-[9px] font-black text-white/20', 'text-[10px] font-black text-white/30')
content = content.replace('text-[10px] font-black text-white/40', 'text-[11px] font-black text-white/50')
content = content.replace('text-[9px] text-white/40 uppercase', 'text-[10px] text-white/40 uppercase')

# 4. Fix category tab selection
# The bug was onClick not working well with onBlur of the input. We will change onClick to onMouseDown and add e.preventDefault()
cat_old = 'onClick={() => handleSelectCat(cat.id, cat.label)}'
cat_new = 'onMouseDown={(e) => { e.preventDefault(); handleSelectCat(cat.id, cat.label); if (typeof document !== "undefined") (document.activeElement as HTMLElement)?.blur(); }}'
content = content.replace(cat_old, cat_new)

# 5. Fix text color of inputs to company theme (nexus-teal)
content = content.replace('className="w-full h-9 px-6 rounded-full font-bold"', 'className="w-full h-9 px-6 rounded-full font-bold text-nexus-teal"')

# 6. Conversions array for UOM
# We need to add conversions to formData state
if 'conversions: []' not in content:
    content = content.replace('conversionRate: 1,', 'conversionRate: 1,\n    conversions: [] as any[],')

# Add SmartComboBox at the end of file
smart_combo = '''
function SmartComboBox({ value, onChange, options, placeholder = "", className = "" }: { value: string, onChange: (v: string) => void, options: string[], placeholder?: string, className?: string }) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [search, setSearch] = React.useState(value);
  
  React.useEffect(() => {
    if (!isFocused) setSearch(value);
  }, [value, isFocused]);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full">
      <div className="relative">
        <PillInput
          value={search}
          onChange={(e: any) => {
            setSearch(e.target.value);
            setIsFocused(true);
            onChange(e.target.value);
          }}
          onFocus={() => {
            setIsFocused(true);
            if (options.includes(search)) {
              setSearch("");
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsFocused(false);
              setSearch(value);
            }, 200);
          }}
          placeholder={placeholder}
          className={className}
        />
        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
      </div>
      
      {isFocused && (
        <div className="absolute top-full left-0 mt-2 min-w-full w-max max-w-[300px] bg-[#0A0A0A]/95 backdrop-blur-2xl border border-cyan-500/20 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,255,209,0.2)] z-[500] overflow-hidden flex flex-col py-2 max-h-48 overflow-y-auto custom-scrollbar">
          {filtered.map(opt => (
            <div 
              key={opt}
              className="flex items-center px-4 py-2 hover:bg-cyan-500/10 cursor-pointer group transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setSearch(opt);
                setIsFocused(false);
                if (typeof document !== 'undefined') (document.activeElement as HTMLElement)?.blur();
              }}
            >
              <span className={value === opt ? "text-[13px] font-black text-cyan-400" : "text-[13px] font-bold text-white/70 group-hover:text-cyan-400/80"}>{opt}</span>
            </div>
          ))}
          {search.trim() && !options.find(o => o.toLowerCase() === search.toLowerCase()) && (
            <div 
              className="flex items-center px-4 py-2 hover:bg-cyan-500/10 cursor-pointer text-cyan-400 text-xs font-black"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(search);
                setIsFocused(false);
                if (typeof document !== 'undefined') (document.activeElement as HTMLElement)?.blur();
              }}
            >
              <Plus size={14} className="mr-2" /> เพิ่ม "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
'''

if 'function SmartComboBox' not in content:
    content += smart_combo

# Base Unit Replacement
base_old = '''<PillSelect value={formData.baseUnit} onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })} className="w-full h-9 px-6 rounded-full text-center font-bold text-nexus-teal">
                        {uomOptions.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                      </PillSelect>'''
base_new = '''<SmartComboBox 
                        options={uomOptions} 
                        value={formData.baseUnit} 
                        onChange={(val) => setFormData({...formData, baseUnit: val})} 
                        className="w-full h-9 px-6 pr-10 rounded-full text-center font-bold text-nexus-teal"
                        placeholder="เลือกหรือพิมพ์หน่วย..."
                      />'''
content = content.replace(base_old, base_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Script applied.")
