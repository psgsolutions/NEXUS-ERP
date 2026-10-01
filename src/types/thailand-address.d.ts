declare module 'thailand-address' {
  export function searchAddressByPostalCode(postalCode: string): Array<{
    district?: string;
    subdistrict?: string;
    amphoe?: string;
    province?: string;
    changwat?: string;
    zipcode?: string;
  }>;
  export function searchAddressBySubdistrict(subdistrict: string): any[];
  export function searchAddressByDistrict(district: string): any[];
  export function searchAddressByProvince(province: string): any[];
}
