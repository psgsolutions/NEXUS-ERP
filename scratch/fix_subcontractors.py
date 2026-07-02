import re

with open('src/app/(authenticated)/projects/subcontractors/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('SearchablePillSelect', 'PillSelect')
content = content.replace('currentCompanyId', 'companyId')

if 'import { cn }' not in content:
    content = content.replace('import { db } from "@/lib/firebase-client";', 'import { db } from "@/lib/firebase-client";\nimport { cn } from "@/lib/utils";')

content = re.sub(r'icon=\{<Search size=\{14\} />\}\s*', '', content)
content = re.sub(r'<Modal\s+isOpen=\{isNewWOModalOpen\}\s+onClose=\{([^}]+)\}\s+title=\{([^}]+)\}\s+maxWidth=\{([^}]+)\}\s+className=\{([^}]+)\}', r'<Modal isOpen={isNewWOModalOpen} onClose={\1} title={\2} maxWidth={\3}', content)
content = re.sub(r'<Modal\s+isOpen=\{isEvaluationModalOpen\}\s+onClose=\{([^}]+)\}\s+title=\{([^}]+)\}\s+maxWidth=\{([^}]+)\}\s+className=\{([^}]+)\}', r'<Modal isOpen={isEvaluationModalOpen} onClose={\1} title={\2} maxWidth={\3}', content)

content = content.replace('status === "ACTIVE" ? "active" : status === "COMPLETED" ? "success" : "danger"', 'status === "ACTIVE" ? "active" : status === "COMPLETED" ? "active" : "danger"')
content = re.sub(r'wo\.status === "COMPLETED" \? "success"', 'wo.status === "COMPLETED" ? "active"', content)

content = content.replace('type: "success" | "error" | "info"', 'type: "success" | "error" | "warning"')
content = content.replace('"info"', '"warning"')

with open('src/app/(authenticated)/projects/subcontractors/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
