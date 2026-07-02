"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { PillInput, PillSelect, NexusTable, NexusTableRow, NexusTableCell, PillButton, cn, NexusDatePicker } from "@/components/ui/Base";
import { FormTemplate, FormField } from "@/types/database";

interface FormRendererProps {
  template: FormTemplate;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  disabled?: boolean;
}

export default function FormRenderer({ template, values, onChange, disabled = false }: FormRendererProps) {
  
  const handleFieldChange = (fieldId: string, val: any) => {
    onChange({
      ...values,
      [fieldId]: val
    });
  };

  // Dynamic table row functions
  const handleAddTableRow = (fieldId: string) => {
    const currentTableData = values[fieldId] || [];
    const newRow = { id: `row_${Date.now()}`, detail: "", quantity: 0, amount: 0 };
    handleFieldChange(fieldId, [...currentTableData, newRow]);
  };

  const handleRemoveTableRow = (fieldId: string, rowId: string) => {
    const currentTableData = values[fieldId] || [];
    handleFieldChange(fieldId, currentTableData.filter((r: any) => r.id !== rowId));
  };

  const handleUpdateTableRow = (fieldId: string, rowId: string, key: string, val: any) => {
    const currentTableData = values[fieldId] || [];
    handleFieldChange(fieldId, currentTableData.map((row: any) => {
      if (row.id === rowId) {
        const updated = { ...row, [key]: val };
        // Recalculate total amount if quantity or amount per unit changes
        if (key === "quantity" || key === "amountPerUnit") {
          const qty = Number(key === "quantity" ? val : row.quantity) || 0;
          const unitPrice = Number(key === "amountPerUnit" ? val : row.amountPerUnit) || 0;
          updated.amount = qty * unitPrice;
        }
        return updated;
      }
      return row;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-6">
        {template.fields.map((field) => {
          const spanClass = 
            field.type === "table" ? "col-span-4" :
            field.gridSpan === 1 ? "col-span-1" :
            field.gridSpan === 2 ? "col-span-2" :
            field.gridSpan === 3 ? "col-span-3" :
            "col-span-4";

          const isRequired = field.required;

          // Standard Input Renderer
          return (
            <div key={field.id} className={cn(spanClass, "space-y-2.5")}>
              <label className="text-[12px] font-black text-white/30 uppercase tracking-widest block">
                {field.label} {isRequired && <span className="text-danger">*</span>}
              </label>

              {/* RENDER FIELD BASED ON TYPE */}
              {field.type === "dropdown" ? (
                <PillSelect
                  value={values[field.id] || ""}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  disabled={disabled}
                  className="w-full"
                >
                  <option value="">เลือกรายการ...</option>
                  {field.options?.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </PillSelect>
              ) : field.type === "date" ? (
                <NexusDatePicker value={values[field.id] || ""}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  disabled={disabled}
                  className="w-full text-white"
                  required={isRequired}
                />
              ) : field.type === "number" ? (
                <PillInput
                  type="number"
                  value={values[field.id] || ""}
                  onChange={(e) => handleFieldChange(field.id, parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  placeholder="0.00"
                  className="w-full font-mono text-[13px] tracking-wide"
                  required={isRequired}
                />
              ) : field.type === "table" ? (
                <div className="col-span-4 border border-white/5 bg-[#0a0a0c]/60 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-[11px] font-black text-nexus-teal uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-nexus-teal shadow-neon-teal animate-pulse" />
                      รายละเอียดรายการย่อยในตาราง / Dynamic Sub-table
                    </span>
                    {!disabled && (
                      <PillButton 
                        type="button"
                        onClick={() => handleAddTableRow(field.id)}
                        className="h-8 px-4 text-[11px] shadow-neon-teal text-black"
                      >
                        <Plus size={14} /> เพิ่มรายการย่อย
                      </PillButton>
                    )}
                  </div>

                  <NexusTable 
                    headers={
                      disabled 
                        ? ["รายละเอียด (ไทย)", "จำนวน", "ราคาต่อหน่วย", "รวมเงิน (บาท)"]
                        : ["รายละเอียด (ไทย)", "จำนวน", "ราคาต่อหน่วย", "รวมเงิน (บาท)", "เครื่องมือ"]
                    }
                    minWidth="min-w-[700px]"
                  >
                    {(!values[field.id] || values[field.id].length === 0) ? (
                      <NexusTableRow>
                        <NexusTableCell 
                          colSpan={disabled ? 4 : 5} 
                          className="p-8 text-center text-[11px] text-white/20 uppercase font-black tracking-widest border-0 bg-transparent"
                        >
                          ยังไม่มีรายการข้อมูลในตารางย่อย
                        </NexusTableCell>
                      </NexusTableRow>
                    ) : (
                      (values[field.id] || []).map((row: any, rIdx: number) => (
                        <NexusTableRow key={row.id}>
                          <NexusTableCell className="px-3 py-1.5">
                            <PillInput
                              value={row.detail || ""}
                              onChange={(e) => handleUpdateTableRow(field.id, row.id, "detail", e.target.value)}
                              disabled={disabled}
                              placeholder="ระบุข้อมูลรายละเอียด..."
                              className="w-full h-8 px-3 rounded-lg text-[12px] bg-transparent border-0 focus:bg-white/[0.04]"
                            />
                          </NexusTableCell>
                          <NexusTableCell className="px-3 py-1.5 w-[15%]">
                            <PillInput
                              type="number"
                              value={row.quantity || 0}
                              onChange={(e) => handleUpdateTableRow(field.id, row.id, "quantity", Number(e.target.value))}
                              disabled={disabled}
                              placeholder="0"
                              className="w-full h-8 px-3 rounded-lg text-[12px] font-mono bg-transparent border-0 focus:bg-white/[0.04] text-right"
                            />
                          </NexusTableCell>
                          <NexusTableCell className="px-3 py-1.5 w-[20%]">
                            <PillInput
                              type="number"
                              value={row.amountPerUnit || 0}
                              onChange={(e) => handleUpdateTableRow(field.id, row.id, "amountPerUnit", Number(e.target.value))}
                              disabled={disabled}
                              placeholder="0.00"
                              className="w-full h-8 px-3 rounded-lg text-[12px] font-mono bg-transparent border-0 focus:bg-white/[0.04] text-right"
                            />
                          </NexusTableCell>
                          <NexusTableCell mono={true} className="px-5 py-1.5 text-right text-[13px]">
                            ฿{(row.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </NexusTableCell>
                          {!disabled && (
                            <NexusTableCell className="px-3 py-1.5 text-center w-[10px]">
                              <button
                                type="button"
                                onClick={() => handleRemoveTableRow(field.id, row.id)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white/20 hover:text-danger hover:bg-danger/10 transition-all border border-transparent hover:border-danger/10"
                              >
                                <Trash2 size={13} />
                              </button>
                            </NexusTableCell>
                          )}
                        </NexusTableRow>
                      ))
                    )}
                  </NexusTable>
                </div>
              ) : (
                <PillInput
                  type="text"
                  value={values[field.id] || ""}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  disabled={disabled}
                  placeholder="กรอกข้อความทั่วไป..."
                  className="w-full text-[13px]"
                  required={isRequired}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
