import os

history_path = r'C:\Users\nanon\AppData\Roaming\Code\User\History'
target_string = 'sourceMode === "manual"' # This was in the 1022 lines version

matches = []

for root, dirs, files in os.walk(history_path):
    for file in files:
        if file != 'entries.json':
            full_path = os.path.join(root, file)
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if target_string in content and 'poItems' in content:
                        # get modification time
                        mtime = os.path.getmtime(full_path)
                        matches.append((mtime, full_path, len(content)))
            except:
                pass

# Sort by modification time descending
matches.sort(reverse=True)

for m in matches[:5]:
    print(f"Match: {m[1]} | Size: {m[2]} | MTime: {m[0]}")
