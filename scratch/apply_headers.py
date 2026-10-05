import os
import re

# 38. accounting/invoices/new/page.tsx
def update_accounting_invoices_new():
    p = 'src/app/(authenticated)/accounting/invoices/new/page.tsx'
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    
    if 'ArrowLeft' not in c:
        c = c.replace('import { FileText, Save, CheckCircle2 } from \'lucide-react\';', 'import { ArrowLeft, FileText, Save, CheckCircle2 } from \'lucide-react\';')
    
    old_h_pattern = r'<div className="flex items-center justify-between border-b border-white/5 pb-4">[\s\S]*?</PillButton>\s*</div>'
    new_h = '''<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <PillButton variant="glass" onClick={() => window.history.back()} className="w-10 h-10 p-0 flex items-center justify-center">
                <ArrowLeft size={20} />
              </PillButton>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
                    สร้างใบแจ้งหนี้
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                    INV-NEW
                  </span>
                </div>
                <p className="text-sm text-white/60 font-medium mt-1">
                  บันทึกและออกใบแจ้งหนี้ อ้างอิงใบสั่งขายและคำนวณภาษีมูลค่าเพิ่ม
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
              <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => window.history.back()}>
                ยกเลิก
              </PillButton>
              <PillButton variant="confirm" onClick={handleSave} disabled={loading} className="h-8 px-5 font-bold text-xs">
                <Save size={14} className="mr-1.5" /> {loading ? 'กำลังบันทึก...' : 'บันทึกใบแจ้งหนี้'}
              </PillButton>
            </div>
          </div>'''
    c = re.sub(old_h_pattern, new_h, c, count=1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Updated {p}")

# 39. settings/users/page.tsx
def update_settings_users():
    p = 'src/app/(authenticated)/settings/users/page.tsx'
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    
    old_h = re.search(r'  const headerContent = \([\s\S]*?\n  \);', c)
    if not old_h:
        print(f"Header not found in {p}")
        return
    
    new_h = '''  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
          <Users size={20} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">จัดการผู้ใช้งานและสิทธิ์</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              USERS-ROLES
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">กำหนดบทบาท สิทธิ์การเข้าถึง และจัดการบัญชีผู้ใช้งานในระบบ</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs">
          <UserPlus size={14} className="mr-1.5" />
          เพิ่มผู้ใช้งานใหม่
        </PillButton>
      </div>
    </div>
  );'''
    c = c.replace(old_h.group(0), new_h, 1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Updated {p}")

# 40. settings/numbering/page.tsx
def update_settings_numbering():
    p = 'src/app/(authenticated)/settings/numbering/page.tsx'
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    
    old_h_pattern = r'\{\/\* HEADER BAR \*\/\}[\s\S]*?\{\/\* TEMPLATE HELP TOKEN BAR \*\/\}'
    new_h = '''{/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
            <Hash size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">ระบบกำหนดรูปแบบเลขที่เอกสารและสินค้า</h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                NUMBERING
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">
              รองรับมาตรฐานสรรพากรสำหรับใบกำกับภาษี และ e-Tax Invoice พร้อมพรีวิวตัวอย่างลำดับเลขเรียลไทม์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <PillButton variant="glass" onClick={fetchSchemes} className="h-8 px-4 text-xs font-bold">
            <RefreshCw size={14} className={cn("mr-1.5", loading && "animate-spin")} />
            รีเฟรชข้อมูล
          </PillButton>
        </div>
      </div>

      {/* TEMPLATE HELP TOKEN BAR */}'''
    c = re.sub(old_h_pattern, new_h, c, count=1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Updated {p}")

# 41. reports/templates/page.tsx
def update_reports_templates():
    p = 'src/app/(authenticated)/reports/templates/page.tsx'
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    
    if 'ArrowLeft' not in c:
        c = c.replace('import { \n  FileSpreadsheet,', 'import { \n  ArrowLeft,\n  FileSpreadsheet,')

    old_h_pattern = r'\{\/\* 1\. Header Toolbar \*\/\}[\s\S]*?\{\/\* 2\. Statistical Metric Cards \*\/\}'
    new_h = '''{/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
            <ArrowLeft size={20} />
          </PillButton>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
                จัดการแม่แบบแบบฟอร์มเอกสาร
              </h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                TEMPLATES
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">
              ปรับแต่งและจัดการแม่แบบเอกสารสำหรับพิมพ์และส่งออกในระบบ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <PillButton 
            variant="confirm"
            onClick={() => {
              setEditingTemplate(null);
              setIsBuilderOpen(true);
            }} 
            className="h-8 px-5 font-bold text-xs"
          >
            <Plus size={14} className="mr-1.5" />
            สร้างแม่แบบฟอร์มใหม่
          </PillButton>
        </div>
      </div>

      {/* 2. Statistical Metric Cards */}'''
    c = re.sub(old_h_pattern, new_h, c, count=1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Updated {p}")

# 42. finance/expenses/page.tsx
def update_finance_expenses_page():
    p = 'src/app/(authenticated)/finance/expenses/page.tsx'
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    
    old_h_pattern = r'\{\/\* Header Section \*\/\}[\s\S]*?<div className="grid grid-cols-1 lg:grid-cols-3'
    new_h = '''{/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/30">
            <Receipt size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">จัดการค่าใช้จ่ายหน้างาน</h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                EXPENSES
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">สแกนใบเสร็จค่าใช้จ่าย ตรวจสอบและส่งขออนุมัติค่าใช้จ่ายหน้างาน</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <PillButton variant="glass" className="h-8 px-4 text-xs font-bold flex items-center gap-1.5">
             <Receipt size={14} />
             สรุปรายงานเดือนนี้
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3'''
    c = re.sub(old_h_pattern, new_h, c, count=1)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Updated {p}")

update_accounting_invoices_new()
update_settings_users()
update_settings_numbering()
update_reports_templates()
update_finance_expenses_page()
