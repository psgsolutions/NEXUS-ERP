import addressService from 'thailand-address';
import rawDb from 'thailand-address/lib/database/db.json';

let isLoaded = false;

function ensureLoaded() {
  if (!isLoaded) {
    try {
      const svc = addressService as any;
      if (svc && typeof svc.load === 'function') {
        svc.load(rawDb, 'json', true);
      }
      isLoaded = true;
    } catch (e) {
      console.warn("AddressService load warning:", e);
    }
  }
}

export function searchAddressByPostalCode(postalCode: string): Array<{
  subdistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
}> {
  if (!postalCode || postalCode.trim().length !== 5) return [];
  ensureLoaded();
  try {
    const svc = addressService as any;
    if (svc && typeof svc.query === 'function') {
      const matches = svc.query({ zipcode: postalCode.trim() });
      if (Array.isArray(matches) && matches.length > 0) {
        return matches.map((m: any) => ({
          subdistrict: m.subdistrict || m.subDistrict || "",
          district: m.district || "",
          province: m.province || "",
          zipcode: m.zipcode || m.zipCode || postalCode.trim()
        }));
      }
    }
  } catch (e) {
    console.warn("Address search error:", e);
  }

  return [];
}
