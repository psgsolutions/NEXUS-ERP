import os

directories = ['src/app/(authenticated)']

for root, _, files in os.walk(directories[0]):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Remove variant="glass" to restore default primary transparent color
            new_content = content.replace('variant="glass"', '')
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {filepath}')
