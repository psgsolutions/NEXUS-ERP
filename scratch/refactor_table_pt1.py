import re

filepath = r"d:\NEXUS-ERP\src\components\commerce\DocumentItemsTable.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Imports
if "useCallback" not in content:
    content = content.replace("import React, { useState, useMemo, useRef, useEffect } from \"react\";", 
                              "import React, { useState, useMemo, useRef, useEffect, useCallback } from \"react\";")

# 2. Add `discount` to initial states and `notifyChange`
notify_change_old = """  const notifyChange = (newItems: any[]) => {
    const sub = newItems.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
    const tax = sub * (taxRate / 100);
    onChange(newItems, { subtotal: sub, taxAmount: tax, grandTotal: sub + tax });
  };"""

notify_change_new = """  const notifyChange = (newItems: any[]) => {
    const sub = newItems.reduce((sum, item) => {
      const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
      let discountAmt = 0;
      if (item.discount) {
        const str = String(item.discount).trim();
        if (str.endsWith('%')) {
          const pct = Number(str.replace('%', '')) || 0;
          discountAmt = lineTotal * (pct / 100);
        } else {
          discountAmt = Number(str.replace(/,/g, '')) || 0;
        }
      }
      return sum + Math.max(0, lineTotal - discountAmt);
    }, 0);
    const tax = sub * (taxRate / 100);
    onChange(newItems, { subtotal: sub, taxAmount: tax, grandTotal: sub + tax });
  };"""
content = content.replace(notify_change_old, notify_change_new)

# Add discount to addItem and addSubItem
content = content.replace('cost: 0 \n    }]);', 'cost: 0,\n      discount: "" \n    }]);')
content = content.replace('cost: 0\n    });', 'cost: 0,\n      discount: ""\n    });')

# Update InlineRow definition to receive onEnterNextRow
content = content.replace("availableProducts \n}: any)", "availableProducts,\n  onEnterNextRow \n}: any)")
content = content.replace('availableProducts={availableProducts}\n          />', 'availableProducts={availableProducts}\n            onEnterNextRow={() => index === items.length - 1 ? addItem() : null}\n          />')

# 3. Add Debounce and Keyboard Handlers in InlineRow
inline_row_state_old = """  const [activeSearchField, setActiveSearchField] = useState<'sku' | 'name' | null>(!item.productId && !item.name ? 'name' : null);
  const [searchTerm, setSearchTerm] = useState(item.productId ? item.name : "");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return availableProducts;
    const lower = searchTerm.toLowerCase();
    return availableProducts.filter((p: any) => 
      p.name.toLowerCase().includes(lower) || 
      (p.sku && p.sku.toLowerCase().includes(lower))
    );
  }, [availableProducts, searchTerm]);"""

inline_row_state_new = """  const [activeSearchField, setActiveSearchField] = useState<'sku' | 'name' | null>(!item.productId && !item.name ? 'name' : null);
  const [searchTerm, setSearchTerm] = useState(item.productId ? item.name : "");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearchTerm) return availableProducts.slice(0, 50);
    const lower = debouncedSearchTerm.toLowerCase();
    return availableProducts.filter((p: any) => 
      (p.name && p.name.toLowerCase().includes(lower)) || 
      (p.sku && p.sku.toLowerCase().includes(lower))
    ).slice(0, 50);
  }, [availableProducts, debouncedSearchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, nextField: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextField === 'NEXT_ROW') {
        if (onEnterNextRow) onEnterNextRow();
      } else {
        const nextInput = rowRef.current?.querySelector(`[data-field="${nextField}"]`) as HTMLElement;
        if (nextInput) nextInput.focus();
      }
    }
  };
  
  const calculateLineTotal = () => {
    const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
    let discountAmt = 0;
    if (item.discount) {
      const str = String(item.discount).trim();
      if (str.endsWith('%')) {
        const pct = Number(str.replace('%', '')) || 0;
        discountAmt = lineTotal * (pct / 100);
      } else {
        discountAmt = Number(str.replace(/,/g, '')) || 0;
      }
    }
    return Math.max(0, lineTotal - discountAmt);
  };"""
content = content.replace(inline_row_state_old, inline_row_state_new)

# Update Auto-Cleanup
auto_cleanup_old = """        if (activeSearchField) {
          setActiveSearchField(null);
          if (!item.productId && (!searchTerm || searchTerm.trim() === "")) {
            removeItem(item.id);
          } else if (!item.productId && searchTerm.trim() !== "") {
            updateItem(item.id, "name", searchTerm);
          }
        }"""
auto_cleanup_new = """        if (activeSearchField) {
          setActiveSearchField(null);
          if (!item.productId && (!searchTerm || searchTerm.trim() === "") && !item.name) {
            removeItem(item.id);
          } else if (!item.productId && searchTerm.trim() !== "") {
            updateItem(item.id, "name", searchTerm);
          }
        }"""
content = content.replace(auto_cleanup_old, auto_cleanup_new)

# Apply data-field and onKeyDown to Name search
content = content.replace(
    'onChange={(e) => setSearchTerm(e.target.value)}',
    'onChange={(e) => setSearchTerm(e.target.value)}\n                onKeyDown={(e) => handleKeyDown(e, "qty")}'
)
# Apply to SKU search
content = content.replace(
    'onChange={(e) => setSearchTerm(e.target.value)}\n                onKeyDown={(e) => handleKeyDown(e, "qty")}\n                className="w-full h-9 px-2 bg-black/40',
    'onChange={(e) => setSearchTerm(e.target.value)}\n                onKeyDown={(e) => handleKeyDown(e, "name")}\n                className="w-full h-9 px-2 bg-black/40'
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Base Python edits complete. Needs fine-grained replacement for inputs.")
