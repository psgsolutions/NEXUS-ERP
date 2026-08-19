import os

directories = ['src/app/(authenticated)']
for root, _, files in os.walk(directories[0]):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'px-6 py-3 min-h-[76px]' not in content:
                new_content = content.replace(
                    '<header className="px-6 py-3 border-b',
                    '<header className="px-6 py-3 min-h-[76px] border-b'
                )
                
                new_content = new_content.replace(
                    '<header className="px-6 py-3 flex',
                    '<header className="px-6 py-3 min-h-[76px] flex'
                )

                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Updated {filepath}')
