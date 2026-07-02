import { useEffect, useRef } from 'react';

interface UsePOSHardwareProps {
  onBarcodeScan: (barcode: string) => void;
  onSearchFocus: () => void;
  onSuspendCart: () => void;
  onTriggerCheckout: () => void;
}

export function usePOSHardware({
  onBarcodeScan,
  onSearchFocus,
  onSuspendCart,
  onTriggerCheckout,
}: UsePOSHardwareProps) {
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. ระบบคีย์ลัด Hotkeys ตามมาตรฐานสากล (PSG UI Protocol คุมปุ่มสั่งการ)
      if (e.key === 'F1') {
        e.preventDefault();
        onSearchFocus(); // F1 โฟกัสช่องค้นหา
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        onSuspendCart(); // F10 พักบิลชั่วคราว
        return;
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        onTriggerCheckout(); // Ctrl + Enter เพื่อเปิดหน้า Checkout ทันที
        return;
      }

      // Ignore input if it is from an input field, textarea or select, EXCEPT if we are scanning
      // Wait, barcode scanners act like keyboards. We don't want to capture typing in the search box as a barcode
      // unless it's super fast.
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      const currentTime = Date.now();

      // 2. กลไกตรวจสอบเครื่องยิงบาร์โค้ด (ยิงเร็วสม่ำเสมอ แตกต่างจากคนพิมพ์มือ)
      // หากคีย์บอร์ดถูกส่งสัญญาณเข้ามาห่างกันไม่เกิน 30ms ถือเป็น Hardware Scanner
      if (currentTime - lastKeyTime.current > 50) {
        barcodeBuffer.current = ''; // พิมพ์ช้าเกินไปเคลียร์บัฟเฟอร์ทิ้ง
      }

      if (e.key !== 'Enter') {
        if (e.key.length === 1) { // Only capture printable characters
          barcodeBuffer.current += e.key;
        }
      } else {
        // เมื่อเครื่องยิงสแกนเนอร์ส่งท้ายด้วยปุ่ม Enter ส่งข้อมูลไปประมวลผลสต๊อกทันที
        // บาร์โค้ดปกติจะยาวเกิน 2 ตัวอักษร
        if (barcodeBuffer.current.length > 2) {
          e.preventDefault();
          onBarcodeScan(barcodeBuffer.current);
          barcodeBuffer.current = '';
        }
      }

      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBarcodeScan, onSearchFocus, onSuspendCart, onTriggerCheckout]);
}
