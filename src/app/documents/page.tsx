'use client'; // คำสั่งบอกว่านี่คือโค้ดฝั่งหน้าจอผู้ใช้งาน

import { useEffect, useState } from 'react';

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // เมื่อเปิดหน้าเว็บขึ้นมา ให้วิ่งไปสั่งข้อมูลจาก API ทันที
    useEffect(() => {
        fetch('/api/documents')
            .then((res) => res.json())
            .then((result) => {
                if (result.success) {
                    setDocuments(result.data);
                }
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, []);

    return (
        // 🎨 คุมโทนสี Dark Theme ตัด Cyan ตามมาตรฐาน PSG UI Protocol V3.1
        <div className="min-h-screen bg-gray-950 text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto">

                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-cyan-400">คลังเอกสาร NEXUS ERP</h1>
                    {/* 🎨 ปุ่มกดมาตรฐาน: บังคับใช้คลาส h-9 px-6 rounded-full */}
                    <button className="h-9 px-6 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">
                        + สร้างเอกสารใหม่
                    </button>
                </div>

                {/* ส่วนแสดงผลข้อมูล */}
                {isLoading ? (
                    <div className="text-cyan-500 animate-pulse">กำลังสแกนฐานข้อมูล...</div>
                ) : documents.length === 0 ? (
                    <div className="p-8 border border-gray-800 rounded-xl text-center text-gray-500 bg-gray-900/50">
                        ยังไม่มีข้อมูลเอกสารในโกดังครับลูกพี่
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map((doc) => (
                            <div key={doc.id} className="p-4 border border-cyan-900/50 rounded-xl bg-gray-900 flex justify-between items-center hover:border-cyan-500 transition-colors">
                                {/* 🎨 ตัวเลขรหัสเอกสารบังคับใช้ฟอนต์ font-mono */}
                                <span className="font-mono text-cyan-300">{doc.id}</span>
                                <span className="text-sm text-gray-400">ดึงข้อมูลสำเร็จ!</span>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
