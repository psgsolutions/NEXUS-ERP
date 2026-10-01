import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * [NEXUS-AI] PO Scanner Endpoint
 * Real-time Gemini 1.5 Flash Vision Document Extraction
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request);
    if (!genAI) {
      console.error('[AI_SCAN_PO_ERROR]: GEMINI_API_KEY missing in environment');
      return NextResponse.json(
        { success: false, status: 'NEEDS_REVIEW', error: 'GEMINI_API_KEY missing in environment' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('[AI_SCAN_PO_ERROR]: No file provided in payload');
      return NextResponse.json(
        { success: false, status: 'NEEDS_REVIEW', error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an expert purchase order scanner for NEXUS ERP (Intelligence OS). Extract the PO details from this document and return ONLY a valid JSON object.
Keys:
{
  "poNumber": "PO document number",
  "poDate": "YYYY-MM-DD",
  "customerName": "customer/client name",
  "items": [
    {
      "productCode": "item SKU or code",
      "name": "item description",
      "qty": number,
      "unit": "unit of measure",
      "price": number
    }
  ]
}
DO NOT wrap in markdown code blocks. Return raw JSON text only.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      console.error('[AI_SCAN_PO_EXTRACTION_FAILED]: Gemini response empty');
      return NextResponse.json(
        { success: false, status: 'NEEDS_REVIEW', error: 'Gemini extraction returned empty text' },
        { status: 422 }
      );
    }

    let jsonString = text.trim();
    if (jsonString.startsWith('```json')) jsonString = jsonString.substring(7, jsonString.length - 3);
    else if (jsonString.startsWith('```')) jsonString = jsonString.substring(3, jsonString.length - 3);

    let extractedData;
    try {
      extractedData = JSON.parse(jsonString.trim());
    } catch (e: any) {
      console.error('[AI_SCAN_PO_EXTRACTION_FAILED]: JSON parse error:', jsonString, e);
      return NextResponse.json(
        { success: false, status: 'NEEDS_REVIEW', error: 'Failed to parse AI output', raw: jsonString },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, status: 'VERIFIED', data: extractedData });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error('[AI_SCAN_PO_EXCEPTION]:', error);
    return NextResponse.json(
      { success: false, status: 'NEEDS_REVIEW', error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
