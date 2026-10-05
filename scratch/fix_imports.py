import os
import re

# 1. hr/employees/[employeeId]/page.tsx
p1 = 'src/app/(authenticated)/hr/employees/[employeeId]/page.tsx'
with open(p1, 'r', encoding='utf-8') as f:
    c1 = f.read()
if 'ArrowLeft' not in c1:
    c1 = re.sub(r'import\s*\{', 'import {\n  ArrowLeft,', c1, count=1)
    with open(p1, 'w', encoding='utf-8') as f:
        f.write(c1)
    print("Fixed hr/employees/[employeeId]/page.tsx")

# 2. inventory/[id]/page.tsx
p2 = 'src/app/(authenticated)/inventory/[id]/page.tsx'
with open(p2, 'r', encoding='utf-8') as f:
    c2 = f.read()
if 'ArrowLeft' not in c2:
    c2 = re.sub(r'import\s*\{', 'import {\n  ArrowLeft,', c2, count=1)
    with open(p2, 'w', encoding='utf-8') as f:
        f.write(c2)
    print("Fixed inventory/[id]/page.tsx")

# 3. inventory/serials/[id]/page.tsx
p3 = 'src/app/(authenticated)/inventory/serials/[id]/page.tsx'
with open(p3, 'r', encoding='utf-8') as f:
    c3 = f.read()
if 'ArrowLeft' not in c3:
    c3 = re.sub(r'import\s*\{', 'import {\n  ArrowLeft,', c3, count=1)
    with open(p3, 'w', encoding='utf-8') as f:
        f.write(c3)
    print("Fixed inventory/serials/[id]/page.tsx")

# 4. logs/[id]/page.tsx
p4 = 'src/app/(authenticated)/logs/[id]/page.tsx'
with open(p4, 'r', encoding='utf-8') as f:
    c4 = f.read()
if 'ArrowLeft' not in c4:
    c4 = re.sub(r'import\s*\{', 'import {\n  ArrowLeft,', c4, count=1)
    with open(p4, 'w', encoding='utf-8') as f:
        f.write(c4)
    print("Fixed logs/[id]/page.tsx")

# 5. sales/billing-notes/new/page.tsx
p5 = 'src/app/(authenticated)/sales/billing-notes/new/page.tsx'
with open(p5, 'r', encoding='utf-8') as f:
    c5 = f.read()
if 'CheckCircle2' not in c5:
    c5 = re.sub(r'import\s*\{', 'import {\n  CheckCircle2,', c5, count=1)
c5 = c5.replace('onClick={handleSave}', 'onClick={handleCommit}')
with open(p5, 'w', encoding='utf-8') as f:
    f.write(c5)
print("Fixed sales/billing-notes/new/page.tsx")

# 6. sales/customers/[id]/page.tsx
p6 = 'src/app/(authenticated)/sales/customers/[id]/page.tsx'
with open(p6, 'r', encoding='utf-8') as f:
    c6 = f.read()
c6 = c6.replace('import { useRouter } from "next/navigation";', 'import { useRouter, useParams } from "next/navigation";')
c6 = c6.replace('const router = useRouter();', 'const router = useRouter();\n  const params = useParams();')
with open(p6, 'w', encoding='utf-8') as f:
    f.write(c6)
print("Fixed sales/customers/[id]/page.tsx")

# 7. sales/orders/[id]/page.tsx
p7 = 'src/app/(authenticated)/sales/orders/[id]/page.tsx'
with open(p7, 'r', encoding='utf-8') as f:
    c7 = f.read()
c7 = c7.replace('import { useRouter } from "next/navigation";', 'import { useRouter, useParams } from "next/navigation";')
c7 = c7.replace('const router = useRouter();', 'const router = useRouter();\n  const params = useParams();')
with open(p7, 'w', encoding='utf-8') as f:
    f.write(c7)
print("Fixed sales/orders/[id]/page.tsx")

# 8. sales/quotations/[id]/page.tsx
p8 = 'src/app/(authenticated)/sales/quotations/[id]/page.tsx'
with open(p8, 'r', encoding='utf-8') as f:
    c8 = f.read()
if 'FileSpreadsheet' not in c8:
    c8 = re.sub(r'import\s*\{', 'import {\n  FileSpreadsheet,\n  XCircle,', c8, count=1)
c8 = c8.replace('handleApprovalAction("DRAFT")', 'handleApprovalAction("REJECTED")')
c8 = c8.replace('onClick={handleCreateRevision}', 'onClick={() => handleCreateRevisionSubmit()}')
with open(p8, 'w', encoding='utf-8') as f:
    f.write(c8)
print("Fixed sales/quotations/[id]/page.tsx")

# 9. sales/quotations/new/page.tsx
p9 = 'src/app/(authenticated)/sales/quotations/new/page.tsx'
with open(p9, 'r', encoding='utf-8') as f:
    c9 = f.read()
if 'Share2' not in c9:
    c9 = re.sub(r'import\s*\{', 'import {\n  Share2,', c9, count=1)
    with open(p9, 'w', encoding='utf-8') as f:
        f.write(c9)
    print("Fixed sales/quotations/new/page.tsx")

# 10. service/work-orders/new/page.tsx
p10 = 'src/app/(authenticated)/service/work-orders/new/page.tsx'
with open(p10, 'r', encoding='utf-8') as f:
    c10 = f.read()
if 'ArrowLeft' not in c10:
    c10 = re.sub(r'import\s*\{', 'import {\n  ArrowLeft,', c10, count=1)
    with open(p10, 'w', encoding='utf-8') as f:
        f.write(c10)
    print("Fixed service/work-orders/new/page.tsx")

print("All fixes applied successfully")
