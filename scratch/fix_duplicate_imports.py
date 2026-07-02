import re

with open('src/app/(authenticated)/projects/[id]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The script previously replaced 'import {' with 'import { Plus, Trash2,' blindly everywhere.
# We need to clean this up.

content = content.replace('import { Plus, Trash2,', 'import {')

# Now, we just need to import Plus and Trash2 from lucide-react if they are not already there.
if 'lucide-react' in content:
    content = re.sub(r'import\s+\{([^}]+)\}\s+from\s+[\"\']lucide-react[\"\']', r'import {\1, Plus, Trash2} from "lucide-react"', content)
else:
    content = 'import { Plus, Trash2 } from "lucide-react";\n' + content

with open('src/app/(authenticated)/projects/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixes applied.")
