import re
import os

files = [
    'src/app/(authenticated)/projects/page.tsx',
    'src/app/(authenticated)/projects/new/page.tsx',
    'src/app/(authenticated)/projects/[id]/page.tsx',
    'src/app/(authenticated)/projects/reports/new/page.tsx',
    'src/app/(authenticated)/projects/milestones/new/page.tsx',
]

def remove_modal(content, modal_name):
    pattern = rf'<{modal_name}[\s\S]*?/>'
    return re.sub(pattern, '', content)

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace setIs...Open with router.push
    content = content.replace('setIsQuotationOpen(true)', 'router.push("/sales/quotations/new")')
    content = content.replace('setIsKitEditorOpen(true)', 'router.push("/inventory/products/new")')
    content = content.replace('setIsContractorModalOpen(true)', 'router.push("/procurement/suppliers/new")')

    # Remove the state variables
    content = re.sub(r'const \[isQuotationOpen,\s*setIsQuotationOpen\]\s*=\s*useState\(false\);', '', content)
    content = re.sub(r'const \[isKitEditorOpen,\s*setIsKitEditorOpen\]\s*=\s*useState\(false\);', '', content)
    content = re.sub(r'const \[isContractorModalOpen,\s*setIsContractorModalOpen\]\s*=\s*useState\(false\);', '', content)

    # Remove the modal JSX
    content = remove_modal(content, 'QuotationModal')
    content = remove_modal(content, 'KitEditorModal')
    content = remove_modal(content, 'ContractorModal')
    # Also some files might just use ContractorModal or similar.
    content = re.sub(r'<QuotationModal[^>]*>\s*(?:</QuotationModal>)?', '', content)

    # Clean up empty closures or left over onClose calls if they were not self-closing
    content = re.sub(r'<QuotationModal[\s\S]*?</QuotationModal>', '', content)
    content = re.sub(r'<KitEditorModal[\s\S]*?</KitEditorModal>', '', content)
    content = re.sub(r'<ContractorModal[\s\S]*?</ContractorModal>', '', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Removed all remaining modals in projects module.")
