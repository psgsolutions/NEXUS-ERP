import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * รายการประเภท ID ทั้งหมดในระบบ (Strategic ID Protocol V8.5)
 */
export type IdType = 
  | 'PRJ' | 'SKU' | 'KIT' | 'SRV' | 'RMA' 
  | 'QUO' | 'SUP' | 'DLV' | 'CUS' | 'CRM' 
  | 'SUB' | 'REQ' | 'EXP' | 'VLT' | 'FRM' 
  | 'PUR' | 'LOG' | 'INV' | 'REC' | 'GRN' 
  | 'SO'  | 'WHS' | 'STK' | 'ISS' | 'TRF' 
  | 'POS' | 'AUD' | 'COMP' | 'EMP' | 'ICT'
  | 'GL'  | 'BN'  | 'TAX' | 'CN' | 'DN';

/**
 * Romanize Thai characters to English (Karaoke style) for Mnemonics
 */
export function romanizeThai(text: string): string {
  if (!text) return "";
  const thaiToEng: Record<string, string> = {
    'ก': 'K', 'ข': 'KH', 'ค': 'KH', 'ฆ': 'KH', 'ง': 'NG',
    'จ': 'CH', 'ฉ': 'CH', 'ช': 'CH', 'ซ': 'S', 'ฌ': 'CH', 'ญ': 'Y',
    'ฎ': 'D', 'ฏ': 'T', 'ฐ': 'TH', 'ฑ': 'TH', 'ฒ': 'TH', 'ณ': 'N',
    'ด': 'D', 'ต': 'T', 'ถ': 'TH', 'ท': 'TH', 'ธ': 'TH', 'น': 'N',
    'บ': 'B', 'ป': 'P', 'ผ': 'PH', 'ฝ': 'F', 'พ': 'PH', 'ฟ': 'F', 'ภ': 'PH', 'ม': 'M',
    'ย': 'Y', 'ร': 'R', 'ล': 'L', 'ว': 'W', 'ศ': 'S', 'ษ': 'S', 'ส': 'S', 'ห': 'H', 'ฬ': 'L', 'อ': 'A', 'ฮ': 'H'
  };
  
  return text.split('').map(char => thaiToEng[char] || char).join('')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}


/**
 * Client-side Image Resizer V1.0
 * ย่อขนาดรูปภาพให้พอดีกับมิติจัดเก็บ (Max 800px) เพื่อประหยัดพื้นที่และโหลดเร็ว
 */
export async function resizeImage(base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
  });
}
