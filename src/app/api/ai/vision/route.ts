import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      console.error('[AI_VISION_ERROR]: GEMINI_API_KEY is not configured in environment variables');
      return NextResponse.json(
        { 
          success: false, 
          status: 'NEEDS_REVIEW', 
          error: 'GEMINI_API_KEY is not configured in environment variables' 
        },
        { status: 500 }
      );
    }

    await requireApiUser(req);
    const body = await req.json();
    const { imageBase64, type } = body;

    if (!imageBase64) {
      console.error('[AI_VISION_ERROR]: imageBase64 payload missing');
      return NextResponse.json(
        { 
          success: false, 
          status: 'NEEDS_REVIEW', 
          error: 'imageBase64 parameter is required' 
        },
        { status: 400 }
      );
    }

    // Strip data:image prefix if present
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    // Initialize Gemini 1.5 Flash model for multi-modal vision extraction
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let prompt = '';

    if (type === 'business_card') {
      prompt = `
You are an expert data extractor for NEXUS ERP (Intelligence OS). Extract information from this business card image and return ONLY a valid JSON object.
Keys:
{
  "name": "full name of person",
  "company": "company name",
  "email": "email address",
  "phone": "phone number",
  "position": "job title"
}
DO NOT wrap in markdown formatting or add extra commentary. Return raw JSON text only.`;
    } else if (type === 'product_label') {
      prompt = `
You are an expert data extractor for NEXUS ERP (Intelligence OS). Extract information from this product label or barcode and return ONLY a valid JSON object.
Keys:
{
  "name": "product name",
  "brand": "brand name",
  "model": "model number",
  "specifications": "key specs"
}
DO NOT wrap in markdown formatting. Return raw JSON text only.`;
    } else if (type === 'quotation' || type === 'purchase_order') {
      prompt = `
You are an expert document scanner for NEXUS ERP (Intelligence OS). Extract line items and prices from this commercial document and return ONLY a valid JSON object.
Keys:
{
  "vendor": "company/vendor name",
  "poNumber": "document or PO number",
  "items": [
    {
      "description": "item description",
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "grandTotal": number
}
DO NOT wrap in markdown formatting. Return raw JSON text only.`;
    } else {
      prompt = `Extract all text and tabular information from this image as JSON with key "text" and "extractedAt". Return raw JSON text only.`;
    }

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg'
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      console.error('[AI_VISION_EXTRACTION_FAILED]: Gemini response text was empty');
      return NextResponse.json(
        { 
          success: false, 
          status: 'NEEDS_REVIEW', 
          error: 'Gemini API returned an empty extraction result' 
        },
        { status: 422 }
      );
    }

    // Clean markdown code blocks if any
    let jsonString = text.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.substring(7);
      if (jsonString.endsWith('```')) {
        jsonString = jsonString.substring(0, jsonString.length - 3);
      }
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.substring(3);
      if (jsonString.endsWith('```')) {
        jsonString = jsonString.substring(0, jsonString.length - 3);
      }
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonString.trim());
    } catch (e: any) {
      console.error('[AI_VISION_EXTRACTION_FAILED]: JSON parse error on Gemini output:', jsonString, e);
      return NextResponse.json(
        { 
          success: false, 
          status: 'NEEDS_REVIEW', 
          error: 'Failed to parse Gemini output as structured JSON', 
          rawOutput: jsonString 
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      status: 'VERIFIED', 
      data: parsedData 
    });

  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error('[AI_VISION_API_EXCEPTION]: Real-time Gemini Vision API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        status: 'NEEDS_REVIEW', 
        error: error.message || 'Gemini API call failed' 
      },
      { status: 500 }
    );
  }
}
