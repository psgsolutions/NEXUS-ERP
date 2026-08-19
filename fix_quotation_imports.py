import re

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove DocumentStepper import and usage
content = re.sub(r'import { DocumentStepper } from "@/components/commerce/DocumentStepper";\n?', '', content)
content = re.sub(r'<div className="bg-white/\[0\.02\] border border-white/5 rounded-3xl p-4 shadow-2xl">\s*<DocumentStepper currentStep=\{1\} />\s*</div>', '', content)

# Remove availableProducts
content = content.replace('availableProducts={MOCK_PRODUCTS}', '')

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed imports")
