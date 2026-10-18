/**
 * แปลงค่าใน Firestore <-> JSON สำหรับสำรอง/กู้คืนข้อมูล (คงชนิดข้อมูลพิเศษไว้)
 * Timestamp / GeoPoint / DocumentReference / Bytes -> { "__fs": "...", ... }
 */
export function encode(v, admin) {
  if (v === null || v === undefined) return v ?? null;
  if (v instanceof admin.firestore.Timestamp) return { __fs: "ts", s: v.seconds, n: v.nanoseconds };
  if (v instanceof admin.firestore.GeoPoint) return { __fs: "geo", lat: v.latitude, lng: v.longitude };
  if (v instanceof admin.firestore.DocumentReference) return { __fs: "ref", path: v.path };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __fs: "bytes", b64: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return v.map((x) => encode(x, admin));
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x, admin)]));
  return v;
}

export function decode(v, admin, db) {
  if (v === null || v === undefined) return v ?? null;
  if (Array.isArray(v)) return v.map((x) => decode(x, admin, db));
  if (typeof v === "object") {
    if (v.__fs === "ts") return new admin.firestore.Timestamp(v.s, v.n);
    if (v.__fs === "geo") return new admin.firestore.GeoPoint(v.lat, v.lng);
    if (v.__fs === "ref") return db.doc(v.path);
    if (v.__fs === "bytes") return Buffer.from(v.b64, "base64");
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x, admin, db)]));
  }
  return v;
}
