import { describe, expect, it } from "vitest";
import { brandCode, categoryOf, modelKey, splitBrand, suggestSku, variantOf } from "@/lib/sku-scheme";

describe("product code scheme [category]-[brand]-[model](-[variant])", () => {
  it("uses the real model number from the name", () => {
    expect(suggestSku({ name: "ZKTeco : LMB280L ตัว L สำหรับกลอนแม่เหล็ก 600 ปอนด์", partNumber: "ZK-LMB-280L" }).sku).toBe("AC-ZKT-LMB280L");
    expect(suggestSku({ name: "Ruckus : SW ICX8100-48 Non PoE Switch (Up link 1G)", partNumber: "ICX8100-48" }).sku).toBe("NW-RCK-ICX810048");
  });
  it("color and length become the variant", () => {
    expect(suggestSku({ name: "Link : RJ45 TO RJ45 PATCH CORD CAT6/1M.,BLUE", partNumber: "US-5101LZ-4" }).sku).toBe("CB-LNK-5101LZ4-1MBL");
    expect(variantOf("Brother : เทป TZE-631 12mm สีดำพื้นเหลือง")).toBe("BK");
    expect(variantOf("AC 1.8m")).toBe("18M");
  });
  it("distributor item codes (A0143593) are not model numbers", () => {
    expect(modelKey("SSD 2.5 SATA 128GB (3Y) AS350x", "A0143593").key).toBe("AS350X");
  });
  it("brand prefix of the part number is dropped", () => {
    expect(modelKey("HDMI-USB Extender GL-040", "GLK-GL-040", "GLK").key).toBe("GL040");
  });
  it("Thai product type before ':' is not a brand; the English brand after it is", () => {
    expect(splitBrand("กล่องเพิ่มสัญญาณภาพ : Aten VS184A").brand).toBe("Aten");
    expect(splitBrand("เบรกเกอร์ Mitsubishi : 3P NF63CV 32A").brand).toBe("Mitsubishi");
    expect(splitBrand("MINI PC : NUC14 Pro Plus").brand).toBe("");
    expect(brandCode("")).toBe("GEN");
    expect(brandCode("Link")).toBe("LNK");
  });
  it("categories from keywords", () => {
    expect(categoryOf("Dahua : NVR 8CH 12MP").code).toBe("CT");
    expect(categoryOf("TP-LINK : Hub 8 Port").code).toBe("NW");
    expect(categoryOf("คีมมินิปากแบน").code).toBe("TL");
  });
  it("duplicates get -2; names without a usable model fall back to a sequence", () => {
    const taken = new Set<string>();
    expect(suggestSku({ name: "Dahua : NVR 8CH", partNumber: "DHU-4108HS8" }, taken).sku).toBe("CT-DAH-4108HS8");
    expect(suggestSku({ name: "Dahua : NVR 8CH", partNumber: "DHU-4108HS8" }, taken).sku).toBe("CT-DAH-4108HS8-2");
    const f = suggestSku({ name: "คีมมินิปากแบนไม่มีฟัน" }, taken, 353);
    expect(f.fallback).toBe(true);
    expect(f.sku).toBe("TL-GEN-0353");
  });
});
