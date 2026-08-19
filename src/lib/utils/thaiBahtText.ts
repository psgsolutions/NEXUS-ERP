/**
 * Converts a number to Thai Baht text format (e.g. 1500.50 -> "หนึ่งพันห้าร้อยบาทห้าสิบสตางค์")
 */
export function arabicNumberToThaiText(number: number): string {
  if (isNaN(number) || number < 0) return 'ศูนย์บาทถ้วน';
  
  const strNumber = number.toFixed(2);
  const parts = strNumber.split('.');
  const baht = parts[0];
  const satang = parts[1];

  const txtNumArr = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า', 'สิบ'];
  const txtDigitArr = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  const convert = (numStr: string) => {
    let text = '';
    const length = numStr.length;
    for (let i = 0; i < length; i++) {
      const digit = parseInt(numStr.charAt(i));
      const pos = length - i - 1;
      
      if (digit !== 0) {
        if (i === length - 1 && digit === 1 && length > 1) {
          text += 'เอ็ด';
        } else if (i === length - 2 && digit === 2) {
          text += 'ยี่';
        } else if (i === length - 2 && digit === 1) {
          text += ''; // just 'สิบ'
        } else {
          text += txtNumArr[digit];
        }
        text += txtDigitArr[pos % 6];
      }
      
      if (pos > 0 && pos % 6 === 0 && digit !== 0) {
        text += 'ล้าน';
      }
    }
    return text;
  };

  let bahtText = '';
  if (baht === '0') {
    bahtText = 'ศูนย์บาท';
  } else {
    bahtText = convert(baht) + 'บาท';
  }

  let satangText = '';
  if (satang === '00') {
    satangText = 'ถ้วน';
  } else {
    satangText = convert(satang) + 'สตางค์';
  }

  return bahtText + satangText;
}
