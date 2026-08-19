/**
 * Utility functions for validating Thai Tax ID (13 digits)
 */

export function validateThaiTaxId(taxId: string): boolean {
  // Check if string contains exactly 13 digits
  if (!/^\d{13}$/.test(taxId)) {
    return false;
  }

  // Extract first 12 digits and the 13th check digit
  const digits = taxId.split('').map(Number);
  const checkDigit = digits[12];

  // Calculate sum using Modulus 11 logic
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (13 - i);
  }

  // Calculate expected check digit
  const mod = sum % 11;
  const expectedCheckDigit = (11 - mod) % 10;

  return checkDigit === expectedCheckDigit;
}
