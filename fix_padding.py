import os

directories = ['src/app/(authenticated)']

for root, _, files in os.walk(directories[0]):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            new_content = new_content.replace('className="p-5 space-y-3 max-w-[1800px] mx-auto"', 'className="px-6 py-5 space-y-3"')
            new_content = new_content.replace('className="p-5 space-y-3 max-w-[1800px] mx-auto animate-in fade-in duration-700"', 'className="px-6 py-5 space-y-3 animate-in fade-in duration-700"')
            new_content = new_content.replace('className="max-w-[1800px] mx-auto space-y-3 w-full"', 'className="px-6 py-5 space-y-3 w-full"')
            new_content = new_content.replace('className="p-10 space-y-10 max-w-[1800px] mx-auto"', 'className="px-6 py-5 space-y-10"')
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {filepath}')
