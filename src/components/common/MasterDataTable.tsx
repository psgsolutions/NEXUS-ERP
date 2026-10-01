"use client";

import React from "react";

export interface Column {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  isSku?: boolean;
  isNumeric?: boolean;
  render?: (value: any, row: Record<string, any>) => React.ReactNode;
}

export interface MasterDataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  totalItems: number;
  currentPage?: number;
  pageSize?: number;
}

export function MasterDataTable({
  columns,
  data,
  totalItems,
  currentPage = 1,
  pageSize = 10,
}: MasterDataTableProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="w-full space-y-3">
      {/* 📊 ตารางหลัก */}
      <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md shadow-xl custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {columns.map((col, idx) => {
                // จัดวางตำแหน่งหัวตารางให้ตรงกับข้อมูลในคอลัมน์ 100%
                let alignClass = "text-left";
                if (col.isSku) {
                  alignClass = "text-center"; // ตามมาตรฐาน PSG UI Protocol V3.1: รหัสกึ่งกลาง
                } else if (col.isNumeric) {
                  alignClass = "text-right"; // จำนวน/ราคาชิดขวา
                } else if (col.align === "right") {
                  alignClass = "text-right";
                } else if (col.align === "center") {
                  alignClass = "text-center";
                }

                return (
                  <th
                    key={idx}
                    className={`py-3 px-4 text-xs font-black text-white/40 uppercase tracking-widest not-italic ${alignClass} ${
                      col.key === "name" ? "w-full" : "w-auto whitespace-nowrap"
                    }`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-white/[0.04] transition-colors group min-h-[36px]"
                >
                  {columns.map((col, colIndex) => {
                    const value = row[col.key];

                    // กำหนดการจัดวางและฟอนต์ตามประเภทข้อมูล
                    let alignStyle = "text-left";
                    let fontStyle = "text-sm text-white/80 not-italic";

                    if (col.isSku) {
                      alignStyle = "text-center"; // รหัสกึ่งกลาง
                      fontStyle = "font-mono text-sm text-nexus-teal not-italic tracking-tight";
                    } else if (col.isNumeric) {
                      alignStyle = "text-right";
                      fontStyle = "font-mono text-sm text-white not-italic tracking-tight";
                    } else if (col.align === "center") {
                      alignStyle = "text-center";
                    } else if (col.align === "right") {
                      alignStyle = "text-right";
                    }

                    return (
                      <td
                        key={colIndex}
                        className={`py-2 px-4 ${alignStyle} ${fontStyle} ${
                          col.key === "name" ? "w-full" : "w-auto whitespace-nowrap"
                        }`}
                      >
                        {col.render ? col.render(value, row) : value}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-xs text-white/40 not-italic"
                >
                  ไม่พบข้อมูลในระบบ (No Data Found)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🔢 แถบแสดงจำนวนข้อมูล (Pagination & Data Count Indicator) */}
      <div className="flex justify-between items-center px-2 text-xs text-slate-400 not-italic">
        <span>
          แสดง {totalItems > 0 ? startItem : 0}-{endItem} จากทั้งหมด {totalItems} รายการ
        </span>
        <div className="flex gap-2">
          {/* สามารถใส่ปุ่มเปลี่ยนหน้า (Pagination Controls) ตรงนี้เพิ่มเติมได้ */}
        </div>
      </div>
    </div>
  );
}
