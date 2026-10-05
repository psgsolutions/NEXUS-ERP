import re

filepath = r"d:\NEXUS-ERP\src\components\commerce\DocumentItemsTable.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update CompactVerticalStepperInput definition
stepper_old = """const CompactVerticalStepperInput = ({ value, onChange, min = 0 }: { value: number, onChange: (val: number) => void, min?: number }) => {
  return (
    <div className="relative flex items-center bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 rounded-full h-9 w-full group/stepper transition-colors focus-within:border-nexus-teal/50 focus-within:bg-white/[0.02]">
      <input 
        type="number"
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        onFocus={(e) => e.target.select()}"""

stepper_new = """const CompactVerticalStepperInput = ({ value, onChange, min = 0, onKeyDown }: { value: number, onChange: (val: number) => void, min?: number, onKeyDown?: (e: any) => void }) => {
  return (
    <div className="relative flex items-center bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 rounded-full h-9 w-full group/stepper transition-colors focus-within:border-nexus-teal/50 focus-within:bg-white/[0.02]">
      <input 
        data-field="qty"
        type="number"
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        onFocus={(e) => e.target.select()}
        onKeyDown={onKeyDown}"""
content = content.replace(stepper_old, stepper_new)

# 2. Extract matched product inside InlineRow
inline_row_start = """  const calculateLineTotal = () => {"""
inline_row_start_new = """  const matchedProduct = useMemo(() => availableProducts.find((p: any) => p.id === item.productId), [availableProducts, item.productId]);

  const calculateLineTotal = () => {"""
content = content.replace(inline_row_start, inline_row_start_new)

# 3. Apply data-field to search inputs
content = content.replace(
    'onChange={(e) => setSearchTerm(e.target.value)}\n                onKeyDown={(e) => handleKeyDown(e, "qty")}\n                className="w-full h-9 pl-9 pr-4',
    'data-field="name"\n                onChange={(e) => setSearchTerm(e.target.value)}\n                onKeyDown={(e) => handleKeyDown(e, "qty")}\n                className="w-full h-9 pl-9 pr-4'
)
content = content.replace(
    'onChange={(e) => setSearchTerm(e.target.value)}\n                onKeyDown={(e) => handleKeyDown(e, "name")}\n                className="w-full h-9 px-2 bg-black/40',
    'data-field="sku"\n                onChange={(e) => setSearchTerm(e.target.value)}\n                onKeyDown={(e) => handleKeyDown(e, "name")}\n                className="w-full h-9 px-2 bg-black/40'
)

# 4. Update Qty cell
qty_old = """      <div className="w-20 shrink-0">
        {!isLocked ? (
          <CompactVerticalStepperInput 
            value={item.qty} 
            onChange={(val) => updateItem(item.id, "qty", val)}
            min={1}
          />
        ) : ("""
qty_new = """      <div className="w-20 shrink-0">
        {!isLocked ? (
          <CompactVerticalStepperInput 
            value={item.qty} 
            onChange={(val) => updateItem(item.id, "qty", val)}
            min={1}
            onKeyDown={(e) => handleKeyDown(e, "unit")}
          />
        ) : ("""
content = content.replace(qty_old, qty_new)

# 5. Update Unit cell
unit_old = """      <div className="w-20 shrink-0">
        {!isLocked ? (
          <input 
            type="text"
            value={item.unit || ""}
            onChange={(e) => updateItem(item.id, "unit", e.target.value)}
            className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 focus:bg-white/[0.02] text-center font-bold text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic"
          />
        ) : ("""
unit_new = """      <div className="w-20 shrink-0">
        {!isLocked ? (
          matchedProduct?.conversions?.length > 0 ? (
            <select
              data-field="unit"
              value={item.unit || ""}
              onChange={(e) => updateItem(item.id, "unit", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "price")}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 focus:bg-white/[0.02] text-center font-bold text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic appearance-none cursor-pointer"
            >
              <option value={matchedProduct.unit}>{matchedProduct.unit}</option>
              {matchedProduct.conversions.map((c: any, i: number) => (
                <option key={i} value={c.toUnit}>{c.toUnit}</option>
              ))}
            </select>
          ) : (
            <input 
              data-field="unit"
              type="text"
              value={item.unit || ""}
              onChange={(e) => updateItem(item.id, "unit", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "price")}
              onFocus={(e) => e.target.select()}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 focus:bg-white/[0.02] text-center font-bold text-[12px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic"
            />
          )
        ) : ("""
content = content.replace(unit_old, unit_new)

# 6. Update Price cell
price_old = """      <div className="w-24 shrink-0">
        {!isLocked ? (
          isEditingPrice ? (
            <input 
              type="number"
              autoFocus
              value={item.price === 0 ? "" : item.price}
              onChange={(e) => updateItem(item.id, "price", Number(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setIsEditingPrice(false)}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 focus:bg-white/[0.02] text-right font-mono text-[13px] text-white/80 focus:outline-none focus:border-nexus-teal transition-colors not-italic [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <input 
              type="text"
              readOnly
              value={item.price ? item.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ""}
              onClick={() => setIsEditingPrice(true)}
              onFocus={() => setIsEditingPrice(true)}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 text-right font-mono text-[13px] text-white/80 focus:outline-none transition-colors not-italic cursor-text"
            />
          )
        ) : ("""
price_new = """      <div className="w-24 shrink-0">
        {!isLocked ? (
          isEditingPrice ? (
            <input 
              data-field="price"
              type="number"
              autoFocus
              value={item.price === 0 ? "" : item.price}
              onChange={(e) => updateItem(item.id, "price", Number(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setIsEditingPrice(false)}
              onKeyDown={(e) => handleKeyDown(e, "discount")}
              className="w-full h-9 px-2 rounded-full bg-black/20 border border-nexus-teal/30 focus:bg-black/40 text-right font-mono text-[13px] text-white focus:outline-none focus:border-nexus-teal transition-colors not-italic [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <input 
              data-field="price"
              type="text"
              readOnly
              value={item.price ? item.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ""}
              onClick={() => setIsEditingPrice(true)}
              onFocus={() => setIsEditingPrice(true)}
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 text-right font-mono text-[13px] text-white/80 focus:outline-none transition-colors not-italic cursor-text"
            />
          )
        ) : ("""
content = content.replace(price_old, price_new)

# 7. Add Discount Cell + calculateLineTotal update
discount_total_old = """      <div className="w-24 text-right shrink-0">
        <p className="font-mono text-[14px] font-black text-nexus-teal not-italic">{(item.qty * item.price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
      </div>"""
discount_total_new = """      <div className="w-28 shrink-0">
        {!isLocked ? (
          isEditingDiscount ? (
            <input 
              data-field="discount"
              type="text"
              autoFocus
              value={item.discount || ""}
              onChange={(e) => updateItem(item.id, "discount", e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setIsEditingDiscount(false)}
              onKeyDown={(e) => handleKeyDown(e, "NEXT_ROW")}
              placeholder="บาท หรือ %"
              className="w-full h-9 px-2 rounded-full bg-black/20 border border-nexus-teal/30 focus:bg-black/40 text-right font-mono text-[13px] text-white focus:outline-none focus:border-nexus-teal transition-colors not-italic"
            />
          ) : (
            <input 
              data-field="discount"
              type="text"
              readOnly
              value={item.discount && String(item.discount).endsWith('%') ? item.discount : (Number(item.discount) || 0) > 0 ? Number(item.discount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ""}
              onClick={() => setIsEditingDiscount(true)}
              onFocus={() => setIsEditingDiscount(true)}
              placeholder="0.00"
              className="w-full h-9 px-2 rounded-full bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/10 text-right font-mono text-[13px] text-white/80 focus:outline-none transition-colors not-italic cursor-text"
            />
          )
        ) : (
          <div className="text-right"><p className="font-mono text-[13px] text-white/80 not-italic">{item.discount || "0.00"}</p></div>
        )}
      </div>

      <div className="w-24 text-right shrink-0">
        <p className="font-mono text-[14px] font-black text-nexus-teal not-italic">{(calculateLineTotal()).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
      </div>"""
content = content.replace(discount_total_old, discount_total_new)

# 8. Add Discount to Header
header_old = """        <div className="w-24 text-right shrink-0">ราคาต่อหน่วย</div>
        <div className="w-24 text-right shrink-0">จำนวนเงิน</div>"""
header_new = """        <div className="w-24 text-right shrink-0">ราคาต่อหน่วย</div>
        <div className="w-28 text-right shrink-0">ส่วนลด</div>
        <div className="w-24 text-right shrink-0">จำนวนเงิน</div>"""
content = content.replace(header_old, header_new)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("UI Replacements complete.")
