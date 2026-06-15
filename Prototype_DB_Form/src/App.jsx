import { useState, useEffect, useCallback } from 'react';
import {
  getAllCustomers,
  getCustomerById,
  getAllProducts,
  saveDocument,
  getNextDocNumber,
} from './db';

// ── ไอคอน SVG ───────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const IconSave = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);
const IconPrint = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
  </svg>
);
const IconDB = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

// ── รายการเริ่มต้นในตาราง ───────────────────────────────────────────────────
const emptyRow = () => ({ id: Date.now(), name: '', qty: 1, price: 0, discount: 0 });

// ── Component หลัก ──────────────────────────────────────────────────────────
export default function App() {
  // --- State: ข้อมูลจาก DB ---
  const [customersList, setCustomersList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  // --- State: ข้อมูลหัวเอกสาร ---
  const [docType, setDocType] = useState('quotation');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [docDueDate, setDocDueDate] = useState('');
  const [docNote, setDocNote] = useState('');

  // --- State: ลูกค้า ---
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  // --- State: Toggle แสดง/ซ่อน Label ---
  const [showAddress, setShowAddress] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showTaxId, setShowTaxId] = useState(false);
  const [showEmail, setShowEmail] = useState(true);
  const [showContact, setShowContact] = useState(false);

  // --- State: ตารางรายการ ---
  const [items, setItems] = useState([emptyRow()]);

  // --- State: UI ---
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // โหลดข้อมูลตอนเริ่ม
  useEffect(() => {
    getAllCustomers().then(setCustomersList);
    getAllProducts().then(setProductsList);
  }, []);

  // Auto-generate เลขที่เอกสารเมื่อเปลี่ยนประเภท
  useEffect(() => {
    setDocNumber(getNextDocNumber(docType));
  }, [docType]);

  // ดึงข้อมูลลูกค้าจาก DB เมื่อเลือก
  useEffect(() => {
    if (!selectedCustomerId) { setCustomerData(null); return; }
    setCustomerLoading(true);
    getCustomerById(selectedCustomerId).then((data) => {
      setCustomerData(data);
      setCustomerLoading(false);
    });
  }, [selectedCustomerId]);

  // ── ฟังก์ชันจัดการตารางรายการ ──────────────────────────────────────────
  const addRow = () => setItems((prev) => [...prev, emptyRow()]);
  const removeRow = (id) => setItems((prev) => prev.filter((r) => r.id !== id));
  const updateRow = (id, field, value) =>
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const selectProduct = (rowId, productId) => {
    const p = productsList.find((p) => p.id === productId);
    if (p) setItems((prev) => prev.map((r) => r.id === rowId ? { ...r, name: p.name, price: p.price } : r));
  };

  // ── คำนวณยอดเงิน ────────────────────────────────────────────────────────
  const calcRowTotal = (row) => {
    const sub = row.qty * row.price;
    return sub - (sub * (row.discount / 100));
  };
  const subtotal = items.reduce((sum, r) => sum + calcRowTotal(r), 0);
  const vat = subtotal * 0.07;
  const grandTotal = subtotal + vat;
  const fmt = (n) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  // ── บันทึกเอกสาร ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedCustomerId) { alert('กรุณาเลือกลูกค้าก่อนบันทึก'); return; }
    setSaving(true);
    const result = await saveDocument({ docType, docNumber, docDate, customer: customerData, items, grandTotal });
    setSaving(false);
    setSavedMsg(`✅ บันทึกสำเร็จ! เลขที่: ${result.docId}`);
    setTimeout(() => setSavedMsg(''), 4000);
  };

  // ── ชื่อประเภทเอกสาร (ภาษาไทย) ─────────────────────────────────────────
  const docTypeLabel = {
    quotation: 'ใบเสนอราคา',
    invoice: 'ใบแจ้งหนี้',
    purchase_order: 'ใบสั่งซื้อ',
    receipt: 'ใบเสร็จรับเงิน',
  }[docType];

  // ══════════════════════════════════════════════════════════════════════════
  // PRINT PREVIEW MODAL
  // ══════════════════════════════════════════════════════════════════════════
  const PreviewModal = () => (
    <div className="modal-overlay" onClick={() => setShowPreview(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>ตัวอย่างเอกสารก่อนพิมพ์</h3>
          <div className="modal-actions">
            <button className="btn-print" onClick={() => window.print()}>🖨 พิมพ์เอกสาร</button>
            <button className="btn-close" onClick={() => setShowPreview(false)}>✕</button>
          </div>
        </div>
        <div className="print-area" id="printArea">
          {/* หัวเอกสาร */}
          <div className="print-header">
            <div className="print-company">
              <strong>บริษัท NEXUS ERP จำกัด</strong>
              <span>999/1 ถ.รัชดาภิเษก กรุงเทพฯ 10900</span>
              <span>โทร: 02-999-0000 | info@nexus-erp.co.th</span>
            </div>
            <div className="print-doc-info">
              <h2 className="print-doc-type">{docTypeLabel}</h2>
              <table className="print-info-table">
                <tbody>
                  <tr><td>เลขที่:</td><td><strong>{docNumber}</strong></td></tr>
                  <tr><td>วันที่:</td><td>{docDate}</td></tr>
                  {docDueDate && <tr><td>ครบกำหนด:</td><td>{docDueDate}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <hr className="print-divider" />

          {/* ข้อมูลลูกค้า */}
          {customerData && (
            <div className="print-customer">
              <p className="print-attn">เรียน: <strong>{customerData.name}</strong></p>
              {showAddress && <p>ที่อยู่: {customerData.address}</p>}
              {showPhone && <p>โทร: {customerData.phone}</p>}
              {showEmail && <p>อีเมล: {customerData.email}</p>}
              {showTaxId && <p>เลขผู้เสียภาษี: {customerData.taxId}</p>}
              {showContact && <p>ผู้ติดต่อ: {customerData.contact}</p>}
            </div>
          )}

          {/* ตารางรายการ */}
          <table className="print-items-table">
            <thead>
              <tr>
                <th>#</th><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>ส่วนลด%</th><th>รวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={row.id}>
                  <td className="center">{i + 1}</td>
                  <td>{row.name || '-'}</td>
                  <td className="center">{row.qty}</td>
                  <td className="right">{fmt(row.price)}</td>
                  <td className="center">{row.discount}%</td>
                  <td className="right">{fmt(calcRowTotal(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ยอดรวม */}
          <div className="print-totals">
            <div className="print-totals-inner">
              <div className="total-row"><span>ยอดก่อนภาษี:</span><span>{fmt(subtotal)}</span></div>
              <div className="total-row"><span>ภาษีมูลค่าเพิ่ม 7%:</span><span>{fmt(vat)}</span></div>
              <div className="total-row grand"><span>ยอดรวมทั้งสิ้น:</span><span>{fmt(grandTotal)} บาท</span></div>
            </div>
          </div>

          {/* หมายเหตุ */}
          {docNote && <div className="print-note"><strong>หมายเหตุ:</strong> {docNote}</div>}

          {/* ลายเซ็น */}
          <div className="print-signatures">
            <div className="sig-box"><div className="sig-line" />ผู้จัดทำ</div>
            <div className="sig-box"><div className="sig-line" />ผู้อนุมัติ</div>
            <div className="sig-box"><div className="sig-line" />ผู้รับเอกสาร</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {showPreview && <PreviewModal />}

      <div className="app">
        {/* ── Top Bar ─────────────────────────────────────────────────── */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-logo">📄</span>
            <span className="topbar-title">document-builder</span>
            <span className="topbar-badge">
              <IconDB /> จำลองการเชื่อมต่อฐานข้อมูล (MS Access Prototype)
            </span>
          </div>
          <div className="topbar-right">
            {savedMsg && <span className="save-success">{savedMsg}</span>}
            <button className="btn-outline" onClick={() => setShowPreview(true)}>
              <IconPrint /> พรีวิวก่อนพิมพ์
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              <IconSave /> {saving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
            </button>
          </div>
        </header>

        <div className="page-content">
          {/* ════════════════════════════════════════════════════════════
              SECTION 1 — ข้อมูลหัวเอกสาร
          ═══════════════════════════════════════════════════════════════ */}
          <section className="card">
            <div className="card-title">
              <span className="step-num">1</span> ข้อมูลเอกสาร
            </div>
            <div className="grid-4">
              <div className="field">
                <label>ประเภทเอกสาร</label>
                <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="quotation">ใบเสนอราคา</option>
                  <option value="invoice">ใบแจ้งหนี้</option>
                  <option value="purchase_order">ใบสั่งซื้อ</option>
                  <option value="receipt">ใบเสร็จรับเงิน</option>
                </select>
              </div>
              <div className="field">
                <label>เลขที่เอกสาร <span className="auto-tag">Auto</span></label>
                <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
              </div>
              <div className="field">
                <label>วันที่เอกสาร</label>
                <input className="input" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
              </div>
              <div className="field">
                <label>วันที่ครบกำหนด</label>
                <input className="input" type="date" value={docDueDate} onChange={(e) => setDocDueDate(e.target.value)} />
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              SECTION 2 — ข้อมูลลูกค้า (Auto-populate + Toggle)
          ═══════════════════════════════════════════════════════════════ */}
          <section className="card">
            <div className="card-title">
              <span className="step-num">2</span> ข้อมูลลูกค้า
              <span className="db-tag"><IconDB /> ดึงจาก Database อัตโนมัติ</span>
            </div>
            <div className="customer-layout">
              {/* ฝั่งซ้าย: เลือกลูกค้า */}
              <div className="customer-left">
                <div className="field">
                  <label>เลือกรหัสลูกค้า (Query จาก DB)</label>
                  <select
                    className="input"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">-- กรุณาเลือกลูกค้า --</option>
                    {customersList.map((c) => (
                      <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Toggle ซ่อน/แสดง Label */}
                <div className="toggle-panel">
                  <p className="toggle-panel-title">ตั้งค่าการแสดง Label</p>
                  {[
                    { key: 'showAddress', label: 'ที่อยู่', state: showAddress, set: setShowAddress },
                    { key: 'showPhone', label: 'เบอร์โทรศัพท์', state: showPhone, set: setShowPhone },
                    { key: 'showEmail', label: 'อีเมล', state: showEmail, set: setShowEmail },
                    { key: 'showContact', label: 'ผู้ติดต่อ', state: showContact, set: setShowContact },
                    { key: 'showTaxId', label: 'เลขประจำตัวผู้เสียภาษี', state: showTaxId, set: setShowTaxId },
                  ].map((t) => (
                    <label key={t.key} className="toggle-item">
                      <span className={`toggle-switch ${t.state ? 'on' : ''}`}
                        onClick={() => t.set(!t.state)}>
                        <span className="toggle-knob" />
                      </span>
                      <span className={`toggle-text ${t.state ? 'active' : ''}`}>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ฝั่งขวา: Label Preview (ดึงจาก DB) */}
              <div className="customer-right">
                <p className="label-preview-title">Label Preview (ส่วนหัวเอกสาร)</p>
                <div className="label-preview-box">
                  {customerLoading ? (
                    <div className="db-loading">
                      <div className="spinner" />
                      <span>กำลัง Query ข้อมูลจาก Database...</span>
                    </div>
                  ) : customerData ? (
                    <div className="label-display fade-in">
                      <div className="label-row label-name">
                        <span className="lbl">เรียน:</span>
                        <span className="val name-val">{customerData.name}</span>
                      </div>
                      {showAddress && (
                        <div className="label-row fade-in">
                          <span className="lbl">ที่อยู่:</span>
                          <span className="val">{customerData.address}</span>
                        </div>
                      )}
                      {showPhone && (
                        <div className="label-row fade-in">
                          <span className="lbl">โทร:</span>
                          <span className="val">{customerData.phone}</span>
                        </div>
                      )}
                      {showEmail && (
                        <div className="label-row fade-in">
                          <span className="lbl">อีเมล:</span>
                          <span className="val">{customerData.email}</span>
                        </div>
                      )}
                      {showContact && (
                        <div className="label-row fade-in">
                          <span className="lbl">ผู้ติดต่อ:</span>
                          <span className="val">{customerData.contact}</span>
                        </div>
                      )}
                      {showTaxId && (
                        <div className="label-row fade-in">
                          <span className="lbl">เลขผู้เสียภาษี:</span>
                          <span className="val">{customerData.taxId}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="label-empty">
                      <p>⬅ เลือกรหัสลูกค้า<br />เพื่อดึงข้อมูลมาแสดงที่ Label</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              SECTION 3 — ตารางรายการสินค้า/บริการ
          ═══════════════════════════════════════════════════════════════ */}
          <section className="card">
            <div className="card-title">
              <span className="step-num">3</span> รายการสินค้า / บริการ
            </div>
            <div className="items-table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>รายการ (เลือกจาก DB หรือพิมพ์เอง)</th>
                    <th style={{ width: 80 }}>จำนวน</th>
                    <th style={{ width: 130 }}>ราคา/หน่วย</th>
                    <th style={{ width: 80 }}>ส่วนลด%</th>
                    <th style={{ width: 130 }}>รวม (บาท)</th>
                    <th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={row.id} className="item-row">
                      <td className="center text-muted">{i + 1}</td>
                      <td>
                        <div className="item-name-cell">
                          <select
                            className="input-sm"
                            value=""
                            onChange={(e) => selectProduct(row.id, e.target.value)}
                          >
                            <option value="">— เลือกจาก DB —</option>
                            {productsList.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <input
                            className="input-sm"
                            placeholder="หรือพิมพ์รายการเอง..."
                            value={row.name}
                            onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                          />
                        </div>
                      </td>
                      <td>
                        <input className="input-sm center" type="number" min="1" value={row.qty}
                          onChange={(e) => updateRow(row.id, 'qty', Number(e.target.value))} />
                      </td>
                      <td>
                        <input className="input-sm right" type="number" min="0" value={row.price}
                          onChange={(e) => updateRow(row.id, 'price', Number(e.target.value))} />
                      </td>
                      <td>
                        <input className="input-sm center" type="number" min="0" max="100" value={row.discount}
                          onChange={(e) => updateRow(row.id, 'discount', Number(e.target.value))} />
                      </td>
                      <td className="right row-total">{fmt(calcRowTotal(row))}</td>
                      <td className="center">
                        {items.length > 1 && (
                          <button className="btn-del" onClick={() => removeRow(row.id)} title="ลบแถว">
                            <IconTrash />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="items-footer">
              <button className="btn-add-row" onClick={addRow}>
                <IconPlus /> เพิ่มแถวรายการ
              </button>
              <div className="totals-block">
                <div className="total-line"><span>ยอดก่อนภาษี:</span><span>{fmt(subtotal)} บาท</span></div>
                <div className="total-line"><span>ภาษีมูลค่าเพิ่ม (7%):</span><span>{fmt(vat)} บาท</span></div>
                <div className="total-line grand"><span>ยอดรวมทั้งสิ้น:</span><span>{fmt(grandTotal)} บาท</span></div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              SECTION 4 — หมายเหตุ
          ═══════════════════════════════════════════════════════════════ */}
          <section className="card">
            <div className="card-title">
              <span className="step-num">4</span> หมายเหตุ / เงื่อนไข
            </div>
            <textarea
              className="input textarea"
              rows={3}
              placeholder="ระบุหมายเหตุ เงื่อนไขการชำระเงิน หรือข้อมูลเพิ่มเติม..."
              value={docNote}
              onChange={(e) => setDocNote(e.target.value)}
            />
          </section>
        </div>
      </div>
    </>
  );
}
