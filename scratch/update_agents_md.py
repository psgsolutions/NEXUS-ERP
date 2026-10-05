import sys

file_path = r"d:\NEXUS-ERP\.agents\AGENTS.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

rule_to_add = """
  5. **การกำหนดความสูงตายตัวและป้องกัน Layout Shift (Anti-Jank Protocol):**
     - **หัวตาราง (Table Header):** กล่องครอบหัวข้อ (เช่น "รายการสินค้า / บริการ") รวมถึงส่วนแสดงสถานะกำไร ต้องมีการกำหนดความสูงตายตัวเสมอ (เช่น ใช้คลาส `h-[36px]` ควบคู่กับ `pb-4`) เพื่อป้องกันไม่ให้ความสูงของหัวตารางขยับขึ้นลง (Layout Shift) เมื่อมีหรือไม่มีแท็บสถานะแสดงขึ้นมา
     - **แท็บสถานะ (Badges/Indicators) ในหัวตาราง:** ต้องใช้ระยะขอบที่น้อยที่สุด เช่น `px-2 py-0 gap-1` (ห้ามใช้ `py-1` หรือ `gap-2` ที่ทำให้ความสูงโดยรวมเกินกว่าข้อความหัวตาราง) เพื่อไม่ให้ดันโครงสร้างให้ขยับ
     - **แถวทุกประเภทในตาราง (Row Heights):** แถวรายการสินค้า (InlineRow), แถวไม่มีข้อมูล (Empty State), และแถวท้ายตาราง (Add Item / Summary) ต้องมีความสูงเท่ากันเป๊ะ (เช่น `36px`) โดยใช้คลาส `min-h-[36px]` และห้ามใส่ Padding แนวตั้งที่มากเกินไป (`py-1`, `py-3`) เพื่อความสม่ำเสมอและกะทัดรัด
"""

# We will inject this before "  1. **ช่องข้อมูลที่ว่างเปล่า (Empty/Unselected State):**" which is after the table rules.
# Wait, looking at the previous file view, there is:
# 52:      - **ฟอนต์ตัวเลขและผลรวมทั้งหมด:** บังคับใช้ฟอนต์ Monospace (`font-mono text-right`) และ **ห้ามมีตัวเอียง (Non-italic Policy 0%)** เด็ดขาด
# 53:   1. **ช่องข้อมูลที่ว่างเปล่า (Empty/Unselected State):** 

if "Anti-Jank Protocol" not in content:
    content = content.replace(
        "     - **ฟอนต์ตัวเลขและผลรวมทั้งหมด:** บังคับใช้ฟอนต์ Monospace (`font-mono text-right`) และ **ห้ามมีตัวเอียง (Non-italic Policy 0%)** เด็ดขาด\n",
        "     - **ฟอนต์ตัวเลขและผลรวมทั้งหมด:** บังคับใช้ฟอนต์ Monospace (`font-mono text-right`) และ **ห้ามมีตัวเอียง (Non-italic Policy 0%)** เด็ดขาด\n" + rule_to_add
    )
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated AGENTS.md successfully.")
else:
    print("Already updated.")
