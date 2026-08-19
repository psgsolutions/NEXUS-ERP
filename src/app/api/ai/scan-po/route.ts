import { NextResponse } from 'next/server';

/**
 * [NEXUS-AI] PO Scanner Endpoint
 * Proxies the uploaded PDF/Image to Document AI / Gemini Pro Vision.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // [TODO]: Hook up actual Google Cloud Document AI SDK or Gemini Vision API here.
    // For now, since we lack the actual API key in this environment, 
    // we simulate the AI extraction delay and return structured data to keep the frontend logic real.
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Simulated Extraction Result from AI
    const extractedData = {
      poNumber: 'PO-2024-9999',
      poDate: new Date().toISOString().split('T')[0],
      customerName: 'บริษัท ตัวอย่าง จำกัด',
      items: [
        { productCode: 'PRD-001', name: 'กล้องวงจรปิด AI', qty: 10, unit: 'ตัว', price: 5000 },
        { productCode: 'LAB-001', name: 'ค่าติดตั้งและเดินสาย', qty: 1, unit: 'งาน', price: 15000, isLabor: true, subjectToWHT: true }
      ]
    };

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error: any) {
    console.error('AI Scan PO Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
