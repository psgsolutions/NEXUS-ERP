# -*- coding: utf-8 -*-
import re

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Import useRouter
if "import { useRouter }" not in content:
    content = content.replace(
        'import { useState, useEffect } from "react";',
        'import { useState, useEffect } from "react";\nimport { useRouter } from "next/navigation";'
    )

# Add router initialization
if "const router = useRouter();" not in content:
    content = content.replace(
        'export default function SalesPage() {\n  const { user, companyId',
        'export default function SalesPage() {\n  const router = useRouter();\n  const { user, companyId'
    )

# Replace quotation button action
content = content.replace(
    'onClick={() => { setSelectedItem(null); setActiveModal("quotation"); }}',
    'onClick={() => router.push("/sales/quotations/new")}'
)

# Replace customer button action
content = content.replace(
    'onClick={() => { setSelectedItem(null); setSelectedCustomer(null); setActiveModal("customer"); }}',
    'onClick={() => router.push("/sales/customers/new")}'
)

# Replace order button action
content = content.replace(
    'onClick={() => { setSelectedItem(null); setActiveModal("order"); }}',
    'onClick={() => router.push("/sales/orders/new")}'
)

# Replace quotation row click
content = content.replace(
    'onClick={() => setSelectedItem(q)}',
    'onClick={() => router.push(`/sales/quotations/${q.id}`)}'
)

# Replace sales order row click
content = content.replace(
    'onClick={() => setSelectedItem(so)}',
    'onClick={() => router.push(`/sales/orders/${so.id}`)}'
)

# Replace customer row click
content = content.replace(
    'onClick={() => setSelectedCustomer(cus)}',
    'onClick={() => router.push(`/sales/customers/${cus.id}`)}'
)

# Replace edit button for Quotation (in the side panel)
content = content.replace(
    'onClick={() => setActiveModal("quotation")}',
    'onClick={() => router.push(`/sales/quotations/${selectedItem.id}`)}'
)

# Replace edit button for Order
content = content.replace(
    'onClick={() => setActiveModal("order")}',
    'onClick={() => router.push(`/sales/orders/${selectedItem.id}`)}'
)

# Replace edit button for Customer
content = content.replace(
    'onClick={() => { setSelectedItem(selectedCustomer); setActiveModal("customer"); }}',
    'onClick={() => router.push(`/sales/customers/${selectedCustomer.id}`)}'
)

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated sales page")
