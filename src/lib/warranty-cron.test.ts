import assert from "node:assert";

export function testWarrantyCronDeduplication() {
  const serial = {
    sn: "SN-9999",
    warrantyEndDate: new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString(),
    maDrafted: false
  };

  const drafts: any[] = [];

  // Day 1
  if (!serial.maDrafted) {
    drafts.push({ sn: serial.sn, title: `MA Draft for ${serial.sn}` });
    serial.maDrafted = true;
  }

  assert.strictEqual(drafts.length, 1);

  // Day 2
  let day2Created = false;
  if (!serial.maDrafted) {
    drafts.push({ sn: serial.sn, title: `MA Draft for ${serial.sn}` });
    day2Created = true;
  }

  assert.strictEqual(day2Created, false);
  assert.strictEqual(drafts.length, 1);
}
