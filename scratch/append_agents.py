import sys

file_path = r'd:\NEXUS-ERP\.agents\AGENTS.md'
with open(file_path, 'a', encoding='utf-8') as f:
    f.write('\n\n- **มาตรฐานฟีเจอร์ความฉลาดเพิ่มเติม (Intelligence Upgrades) สำหรับ DocumentItemsTable:**\n')
    f.write('  1. **Predictive Inventory Context:** เพิ่มกลไก "Stock Threshold Alert" หรือแนะนำสินค้าที่ขายบ่อย (Frequent Items) ขึ้นมาเป็นรายการแรกเมื่อกดค้นหา\n')
    f.write('  2. **Intelligent Unit Conversion:** Auto-Unit Logic หากสินค้าถูกขายในหลายหน่วย (เช่น ชิ้น, กล่อง) ระบบต้องปรับราคา (Price per Unit) ให้สัมพันธ์กับหน่วยนั้นทันทีผ่าน Conversion Rate\n')
    f.write('  3. **Smart Margin Inspector:** (Real-time GP Gauge) ให้มีมาตรวัดกำไรแบบ Live ในฝั่ง Summary Panel เสมอ เพื่อปกป้อง Margin ก่อนกดส่งอนุมัติ\n')
    f.write('  4. **Keyboard Navigation Flow:** ฝังกฎ "Enter-to-Next-to-Add" ที่สมบูรณ์แบบ (ค้นหา ➔ จำนวน ➔ ราคา ➔ ส่วนลด ➔ สร้างแถวใหม่พร้อมวางโฟกัสที่ช่องค้นหาของแถวใหม่) โดยไม่ให้เสียจังหวะ\n')
    f.write('  5. **Auto-Delete Empty Rows:** หากแถวไม่มีการคีย์ชื่อหรือจำนวน เมื่อเสียโฟกัสให้ลบแถวนั้นทิ้งอัตโนมัติ\n')
    f.write('  6. **Real-time Calculation & Bubble Up:** ทุกการแก้ไข จำนวน/ราคา/ส่วนลด ต้องรันการคำนวณและส่งค่า (Bubble up) ไปที่แผง Summary Panel เสมอ ห้ามแสดงยอดรวมใหญ่ๆ ที่ท้ายตาราง\n')
    f.write('  7. **Smart Search (Tenant Isolation):** เชื่อม Firestore `products` ผ่าน `useRealtimeCollection` พร้อมจำกัด `.where(\'companyId\', \'==\', currentCompanyId)` และ `isDeleted == false`\n')
    f.write('  8. **Strict Layout (PSG V3.1):** Data Rows ต้องใช้ `min-h-[36px]` padding `py-1`, ฟิลด์กรอกเป็น `h-9 px-6 rounded-full`, ปุ่มเพิ่มลดซ่อนอยู่ด้านขวา (Hover to show), ห้ามมีตัวอักษรเอียง (Non-italic 100%)\n')

print('Appended Master Prompt to AGENTS.md')
