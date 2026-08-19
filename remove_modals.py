import re

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Modal components rendering
content = re.sub(r'<CustomerModal[\s\S]*?/>\s*<QuotationModal[\s\S]*?/>\s*<SalesOrderModal[\s\S]*?/>\s*<BillingNoteModal[\s\S]*?/>\s*<CNDNModal[\s\S]*?/>', '', content)
# Sometimes they might not be consecutive in exactly that order. I'll just remove them individually.
content = re.sub(r'<CustomerModal[\s\S]*?onSave=\{.*?\}\s*/>', '', content)
content = re.sub(r'<QuotationModal[\s\S]*?onApprove=\{.*?\}\s*/>', '', content)
content = re.sub(r'<SalesOrderModal[\s\S]*?onSave=\{.*?\}\s*/>', '', content)
content = re.sub(r'<BillingNoteModal[\s\S]*?onSave=\{.*?\}\s*/>', '', content)
content = re.sub(r'<CNDNModal[\s\S]*?onSave=\{.*?\}\s*/>', '', content)

# But wait, there are state setters inside, and some might not match the regex easily.
# Let's just use Python to find the start of `<CustomerModal ` and the end of its `/>` block.
def remove_component(html_str, comp_name):
    # Very rudimentary removal: assumes the tag ends with />
    pattern = rf'<{comp_name}\b[^>]*/>'
    # Wait, JSX tags can have nested tags. But these are modals so they probably end with />
    # Using a better approach for multi-line tags:
    pattern = rf'<{comp_name}\s+.*?/>'
    return re.sub(pattern, '', html_str, flags=re.DOTALL)

for modal in ['CustomerModal', 'QuotationModal', 'SalesOrderModal', 'BillingNoteModal', 'CNDNModal']:
    content = remove_component(content, modal)

# Also remove imports
for modal in ['CustomerModal', 'QuotationModal', 'SalesOrderModal', 'BillingNoteModal', 'CNDNModal']:
    content = re.sub(rf'import\s+{modal}\s+from\s+[\'"].*?[\'"];?\n?', '', content)

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Removed modals")
