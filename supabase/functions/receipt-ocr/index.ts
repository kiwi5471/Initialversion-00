import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { imageData, filename } = await req.json();
    
    console.log(`Processing receipt OCR for file: ${filename}`);

    const systemPrompt = `你是一個專業的財務票據 OCR 辨識系統。請仔細分析圖片中的收據或票據，並擷取所有可見的費用明細和文字區塊。

重要限制：
- ocrBlocks 最多只輸出 30 個最重要的區塊（優先保留金額、日期、廠商、統編相關區塊）
- sourceBlockIds 每個 lineItem 最多只關聯 5 個最相關的 block id
- 輸出必須是完整有效的 JSON

請回傳以下格式的 JSON：

{
  "lineItems": [
    {
      "id": "line_001",
      "vendor": "廠商名稱",
      "tax_id": "統一編號（8碼，僅數字，無則為 null）",
      "description": "明細說明或品名",
      "amount": 數字金額,
      "unit": "元",
      "editable": true,
      "sourceBlockIds": ["b_001", "b_002"]
    }
  ],
  "ocrBlocks": [
    {
      "id": "b_001",
      "page": 1,
      "text": "識別出的文字內容",
      "type": "amount",
      "confidence": 0.95,
      "bbox": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05 }
    }
  ],
  "metadata": {
    "vendor": "廠商名稱",
    "tax_id": "統一編號（8碼，無則為 null）",
    "date": "YYYY-MM-DD",
    "total_amount": 總金額數字
  }
}

【lineItems 規則】
1. 每筆費用明細獨立成一列，不合併
2. editable 一律為 true
3. 若僅有總金額無明細，description 為「費用合計」
4. amount 必須為數字
5. sourceBlockIds 最多 5 個，對應 ocrBlocks 的 id

【ocrBlocks 規則】
- 最多 30 個區塊，優先保留重要資訊
- type: title/vendor/date/amount/item/tax_id/total/subtotal/tax/other
- bbox 為 0-1 正規化座標`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '請分析這張收據圖片，擷取所有費用明細和 OCR 文字區塊，並提供精確的 bounding box 座標：'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: '請求過於頻繁，請稍後再試' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: '額度不足，請增加使用額度' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from AI');
    }

    console.log('AI Response:', content);

    // Parse the JSON response from AI
    let extractedData;
    try {
      // Try to extract JSON from markdown code blocks or raw JSON
      let jsonString = content;
      
      // Remove markdown code blocks if present
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1].trim();
      } else {
        // Try to find JSON object directly
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonString = jsonObjectMatch[0];
        }
      }
      
      // Try to fix truncated JSON by closing open brackets
      let fixedJson = jsonString;
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;
      
      // Add missing closing brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixedJson += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedJson += '}';
      }
      
      extractedData = JSON.parse(fixedJson);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw content:', content.substring(0, 500));
      
      // Return minimal valid structure if parsing fails
      extractedData = {
        lineItems: [],
        ocrBlocks: [],
        metadata: {}
      };
    }

    // Validate and format ocrBlocks
    const ocrBlocks = (extractedData.ocrBlocks || []).map((block: any, index: number) => {
      const bbox = block.bbox || {};
      return {
        id: block.id || `b_${String(index + 1).padStart(3, '0')}`,
        page: block.page || 1,
        text: block.text || '',
        type: block.type || 'other',
        confidence: typeof block.confidence === 'number' ? block.confidence : 0.8,
        bbox: {
          x: typeof bbox.x === 'number' ? Math.max(0, Math.min(1, bbox.x)) : 0.1,
          y: typeof bbox.y === 'number' ? Math.max(0, Math.min(1, bbox.y)) : 0.1 + index * 0.08,
          w: typeof bbox.w === 'number' ? Math.max(0.01, Math.min(1, bbox.w)) : 0.8,
          h: typeof bbox.h === 'number' ? Math.max(0.01, Math.min(1, bbox.h)) : 0.04
        }
      };
    });

    // Create a map of block IDs for validation
    const blockIdSet = new Set(ocrBlocks.map((b: any) => b.id));

    // Get vendor and tax_id from metadata for default values
    const metadataVendor = extractedData.metadata?.vendor || extractedData.metadata?.vendor_name || '';
    const metadataTaxId = extractedData.metadata?.tax_id || null;

    // Map lineItems with validated source block references
    const lineItems = (extractedData.lineItems || []).map((item: any, index: number) => {
      // Validate sourceBlockIds - only include IDs that exist in ocrBlocks
      let sourceBlockIds = Array.isArray(item.sourceBlockIds) 
        ? item.sourceBlockIds.filter((id: string) => blockIdSet.has(id))
        : [];
      
      // If no valid sourceBlockIds, try to find related blocks
      if (sourceBlockIds.length === 0) {
        const relatedBlocks = ocrBlocks.filter((block: any) => 
          block.text.includes(String(item.amount)) || 
          block.text.includes(item.description) ||
          block.type === 'amount' ||
          block.type === 'item' ||
          block.type === 'total'
        ).slice(0, 2);
        sourceBlockIds = relatedBlocks.map((b: any) => b.id);
      }

      // Validate tax_id - must be 8 digits only
      let taxId = item.tax_id || metadataTaxId;
      if (taxId && !/^\d{8}$/.test(taxId)) {
        taxId = null;
      }

      return {
        id: item.id || `line_${String(index + 1).padStart(3, '0')}`,
        vendor: item.vendor || metadataVendor || '未知廠商',
        tax_id: taxId,
        description: item.description || '費用明細',
        amount: typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0,
        unit: item.unit || '元',
        editable: true,
        sourceBlockIds: sourceBlockIds.length > 0 ? sourceBlockIds : [ocrBlocks[0]?.id].filter(Boolean)
      };
    });

    // If no lineItems but we have a total, create one line item
    if (lineItems.length === 0 && extractedData.metadata?.total_amount) {
      const totalBlocks = ocrBlocks.filter((b: any) => b.type === 'total' || b.type === 'amount');
      lineItems.push({
        id: 'line_001',
        vendor: metadataVendor || '未知廠商',
        tax_id: metadataTaxId,
        description: '費用合計',
        amount: extractedData.metadata.total_amount,
        unit: '元',
        editable: true,
        sourceBlockIds: totalBlocks.length > 0 ? [totalBlocks[0].id] : []
      });
    }

    // Validate metadata tax_id
    let finalTaxId = extractedData.metadata?.tax_id || null;
    if (finalTaxId && !/^\d{8}$/.test(finalTaxId)) {
      finalTaxId = null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          lineItems,
          ocrBlocks,
          metadata: {
            vendor: metadataVendor || null,
            tax_id: finalTaxId,
            date: extractedData.metadata?.date || null,
            total_amount: typeof extractedData.metadata?.total_amount === 'number' 
              ? extractedData.metadata.total_amount 
              : (typeof extractedData.metadata?.total === 'number' ? extractedData.metadata.total : null)
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in receipt-ocr function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
