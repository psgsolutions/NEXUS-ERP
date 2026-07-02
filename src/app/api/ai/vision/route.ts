import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageBase64, type } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 }
      );
    }

    // Strip the data:image prefix if present
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    // Select the model (flash is best for multi-modal speed)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let prompt = '';

    if (type === 'business_card') {
      prompt = `
You are an expert data extractor. Extract the information from this business card image and return ONLY a valid JSON object.
Use the following keys:
{
  "name": "full name of the person",
  "company": "company name",
  "email": "email address",
  "phone": "phone number",
  "position": "job title or position"
}
If a value is not found, leave it as an empty string. DO NOT wrap in markdown blocks, just return raw JSON.`;
    } else if (type === 'product_label') {
      prompt = `
You are an expert data extractor. Extract the information from this product label or barcode image and return ONLY a valid JSON object.
Use the following keys:
{
  "name": "product name",
  "brand": "brand name",
  "model": "model number or identifier",
  "specifications": "any key specifications found"
}
If a value is not found, leave it as an empty string. DO NOT wrap in markdown blocks, just return raw JSON.`;
    } else if (type === 'quotation') {
      prompt = `
You are an expert data extractor. Extract the items and prices from this quotation or receipt image and return ONLY a valid JSON object.
Use the following structure:
{
  "vendor": "vendor or company name issuing the document",
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
If a value is not found, use default empty or 0 values. DO NOT wrap in markdown blocks, just return raw JSON.`;
    } else {
      prompt = `Extract all textual information from this image and return it as JSON with a "text" key.`;
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

    // Clean up potential markdown formatting from Gemini
    let jsonString = text.trim();
    if (jsonString.startsWith('\`\`\`json')) {
      jsonString = jsonString.substring(7);
      if (jsonString.endsWith('\`\`\`')) {
        jsonString = jsonString.substring(0, jsonString.length - 3);
      }
    } else if (jsonString.startsWith('\`\`\`')) {
      jsonString = jsonString.substring(3);
      if (jsonString.endsWith('\`\`\`')) {
        jsonString = jsonString.substring(0, jsonString.length - 3);
      }
    }
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString.trim());
    } catch (e) {
      console.error('Failed to parse Gemini output as JSON:', jsonString);
      return NextResponse.json(
        { error: 'Failed to parse AI output', raw: jsonString },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error('Vision API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
