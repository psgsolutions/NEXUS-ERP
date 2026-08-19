import os
import re

files_to_fix = [
    'src/app/(authenticated)/dashboard/page.tsx',
    'src/app/(authenticated)/finance/page.tsx',
    'src/app/(authenticated)/hr/page.tsx',
    'src/app/(authenticated)/hr/employees/[id]/page.tsx',
    'src/app/(authenticated)/procurement/page.tsx',
    'src/app/(authenticated)/projects/page.tsx',
    'src/app/(authenticated)/projects/subcontractors/page.tsx',
    'src/app/(authenticated)/projects/[id]/page.tsx',
    'src/app/(authenticated)/sales/page.tsx',
    'src/app/(authenticated)/support/page.tsx',
    'src/components/projects/GanttChart.tsx',
    'src/components/projects/ProfitForecaster.tsx',
    'src/components/ui/DocumentFlowStepper.tsx'
]

def add_opacity(line):
    # Only replace if it doesn't already have /
    line = re.sub(r'(bg-(?:nexus-teal|nexus-blue|danger|warning|emerald-500|blue-500|red-500|purple-500))(?!\/)', r'\1/80', line)
    return line

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    for i, line in enumerate(lines):
        if 'style={{ width:' in line:
            # If the current line has bg-, replace it
            if 'bg-' in line:
                line = add_opacity(line)
            # Otherwise check previous line
            elif i > 0 and 'bg-' in new_lines[-1] and ('className' in new_lines[-1]):
                new_lines[-1] = add_opacity(new_lines[-1])
        new_lines.append(line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Fixed {filepath}")
