## กฎการป้องกัน UI กระพริบ (Anti-Flicker Protocol for Glassmorphism)

ห้ามใช้คลาส `transform-gpu` ร่วมกับ `backdrop-blur` (เช่น `backdrop-blur-md`, `backdrop-blur-3xl`) ใน Component หรือ Layout ที่มีการเชื่อมต่อข้อมูลแบบ Real-time (เช่น Firestore `useRealtimeCollection`, `onSnapshot`) หรือมีการ Re-render บ่อยครั้ง (เช่น `GlassCard`, Dashboard Cards) เด็ดขาด

**สาเหตุ:** 
การใช้ `transform-gpu` เพื่อบังคับเร่งการประมวลผลด้วยฮาร์ดแวร์ เมื่อรวมกับ `backdrop-blur` จะทำให้เบราว์เซอร์ตระกูล Chromium (Google Chrome, Edge) เกิดอาการ Repaint/Layout Thrashing ที่เลเยอร์พื้นหลังกระจกทุกครั้งที่สถานะหรือข้อมูลภายในมีการเปลี่ยนแปลง (แม้เพียงเสี้ยววินาที) ทำให้เกิดอาการ "พื้นหลังการ์ดกระพริบอย่างรุนแรง" (Flickering)

**การแก้ไขและข้อบังคับ:**
- ใช้เพียง `backdrop-blur-[size]` โดยปล่อยให้เบราว์เซอร์จัดการ Compositing เอง ห้ามพ่วง `transform-gpu` 
- ให้ตรวจสอบเสมอเวลาสร้าง Component สไตล์ Glassmorphism ใหม่ๆ ว่าไม่ได้เผลอใส่ `transform-gpu` เข้าไป
