export async function saveToFirestore<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  // Check browser network status first
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error("ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบ Network");
  }

  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("การเชื่อมต่อฐานข้อมูลล้มเหลว เซิร์ฟเวอร์ไม่ตอบสนองภายในเวลาที่กำหนด"));
    }, timeoutMs);
  });

  // Race the actual promise against the timeout
  return Promise.race([promise, timeoutPromise]);
}
