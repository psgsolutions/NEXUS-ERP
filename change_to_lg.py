import os
import re

directories = ['src/app/(authenticated)']

for root, dirs, files in os.walk(directories[0]):
    for file in files:
        if file == 'page.tsx':
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Change the main wrapper from xl:flex-row to lg:flex-row
            content = content.replace('className="flex flex-col xl:flex-row items-start gap-4"', 'className="flex flex-col lg:flex-row items-start gap-4"')
            
            # Change the sidebar from xl:w-[25%] to lg:w-[25%]
            content = content.replace('className="xl:w-[25%] shrink-0 sticky top-[96px]', 'className="lg:w-[25%] shrink-0 sticky top-[96px]')
            
            # Write back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
