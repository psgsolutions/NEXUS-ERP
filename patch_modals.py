import os
import re
import glob

routes = {
    'sales': [
        (r'setActiveModal\(\s*["\']customer["\']\s*\)', r'router.push("/customers/new")'),
        (r'setActiveModal\(\s*["\']quotation["\']\s*\)', r'router.push("/sales/quotations/new")'),
        (r'setActiveModal\(\s*["\']order["\']\s*\)', r'router.push("/sales/orders/new")'),
    ],
    'procurement': [
        (r'setActiveModal\(\s*["\']request["\']\s*\)', r'router.push("/procurement/requests/new")'),
        (r'setActiveModal\(\s*["\']order["\']\s*\)', r'router.push("/procurement/orders/new")'),
        (r'setActiveModal\(\s*["\']supplier["\']\s*\)', r'router.push("/procurement/suppliers/new")'),
    ],
    'inventory': [
        (r'setActiveModal\(\s*["\']in["\']\s*\)', r'router.push("/inventory/in/new")'),
        (r'setActiveModal\(\s*["\']receive["\']\s*\)', r'router.push("/inventory/in/new")'),
        (r'setActiveModal\(\s*["\']transfer["\']\s*\)', r'router.push("/inventory/out/new")'),
        (r'setActiveModal\(\s*["\']product["\']\s*\)', r'router.push("/inventory/products/new")'),
    ],
    'finance': [
        (r'setActiveModal\(\s*["\']receipt["\']\s*\)', r'router.push("/finance/receipts/new")'),
        (r'setActiveModal\(\s*["\']payment["\']\s*\)', r'router.push("/finance/payments/new")'),
        (r'setActiveModal\(\s*["\']journal["\']\s*\)', r'router.push("/finance/journal-entries/new")'),
        (r'setActiveModal\(\s*["\']expense["\']\s*\)', r'router.push("/finance/expense-claims/new")'),
        (r'setActiveModal\(\s*["\']gl["\']\s*\)', r'router.push("/finance/journal-entries/new")'),
        (r'setActiveModal\(\s*["\']ar["\']\s*\)', r'router.push("/finance/receipts/new")'),
        (r'setActiveModal\(\s*["\']ap["\']\s*\)', r'router.push("/finance/payments/new")'),
    ],
    'hr': [
        (r'setActiveModal\(\s*["\']employee["\']\s*\)', r'router.push("/hr/employees/new")'),
        (r'setActiveModal\(\s*["\']clock["\']\s*\)', r'router.push("/hr/attendance/new")'),
        (r'setActiveModal\(\s*["\']payroll["\']\s*\)', r'router.push("/hr/payroll/new")'),
    ],
    'customers': [
        (r'setActiveModal\(\s*.*?["\']customer["\'].*?\)', r'router.push("/customers/new")'),
    ]
}

def process_file(filepath, rules):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    for pattern, replacement in rules:
        content = re.sub(pattern, replacement, content)

    # Some edges cases for sales
    if 'sales' in filepath:
        content = re.sub(r'setActiveModal\(\s*["\']customer["\']\s*\)', r'router.push("/customers/new")', content)
        content = re.sub(r'setActiveModal\(\s*["\']quotation["\']\s*\)', r'router.push("/sales/quotations/new")', content)
        content = re.sub(r'setActiveModal\(\s*["\']order["\']\s*\)', r'router.push("/sales/orders/new")', content)

    # If router.push is used, we need to ensure useRouter is imported and initialized
    if 'router.push' in content and 'useRouter' not in content:
        # Add import
        import_stmt = 'import { useRouter } from "next/navigation";\n'
        imports_end = content.rfind('import ')
        if imports_end != -1:
            next_newline = content.find('\n', imports_end)
            content = content[:next_newline+1] + import_stmt + content[next_newline+1:]
        else:
            content = import_stmt + content
            
        # Add const router = useRouter(); inside the component
        match = re.search(r'export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{', content)
        if match:
            insert_pos = match.end()
            content = content[:insert_pos] + '\n  const router = useRouter();\n' + content[insert_pos:]

    def remove_tag(text, tag_name):
        while True:
            start_idx = text.find(f'<{tag_name}')
            if start_idx == -1:
                break
            
            end_idx = text.find(f'</{tag_name}>', start_idx)
            if end_idx != -1:
                text = text[:start_idx] + text[end_idx + len(f'</{tag_name}>'):]
            else:
                self_close = text.find('/>', start_idx)
                if self_close != -1:
                    text = text[:start_idx] + text[self_close + 2:]
                else:
                    break
        return text

    content = remove_tag(content, 'Modal')
    
    # Remove useState for activeModal
    content = re.sub(r'const\s*\[\s*activeModal\s*,\s*setActiveModal\s*\]\s*=\s*useState<[^>]+>\([^)]*\);', '', content)
    content = re.sub(r'const\s*\[\s*activeModal\s*,\s*setActiveModal\s*\]\s*=\s*useState[^;]+;', '', content)
    
    # There might be left over setActiveModal(null)
    content = re.sub(r'setActiveModal\(null\);?', '', content)
    
    # Fix instances where empty arrow functions are left: () => { ; setSelectedItem(null); }
    content = re.sub(r'\{\s*;\s*', '{ ', content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for module, rules in routes.items():
    index_file = f'src/app/(authenticated)/{module}/page.tsx'
    if os.path.exists(index_file):
        process_file(index_file, rules)

print("Done")
