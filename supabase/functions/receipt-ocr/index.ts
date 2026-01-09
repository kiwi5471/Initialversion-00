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

    const systemPrompt = `你是一個專業的財務票據 OCR 辨識系統。請仔細分析圖片中的收據或票據，並擷取所有可見的費用項目和文字區塊。

重要：你必須為每個文字區塊提供精確的 bounding box 座標 (bbox)，座標值為 0-1 之間的正規化數值（相對於圖片寬高）。

請回傳以下格式的 JSON：
{
  "items": [
    {
      "name": "項目名稱（如：高鐵車票、計程車資、午餐便當等）",
      "amount": 金額數字,
      "category": "類別（transportation/meals/accommodation/equipment/misc/other）",
      "sourceBlockIds": ["對應的 ocrBlock id 陣列，如 b_001, b_002"]
    }
  ],
  "ocrBlocks": [
    {
      "id": "唯一識別碼（格式：b_001, b_002...）",
      "page": 1,
      "text": "識別出的文字內容",
      "type": "文字類型（title/vendor/date/amount/item/tax_id/total/subtotal/tax/other）",
      "confidence": 0.95,
      "bbox": {
        "x": 0.1,
        "y": 0.2,
        "w": 0.3,
        "h": 0.05
      }
    }
  ],
  "metadata": {
    "vendor_name": "店家或供應商名稱",
    "tax_id": "統一編號（如有）",
    "date": "日期 YYYY-MM-DD（如有）",
    "total": 總金額數字
  }
}

bbox 座標說明：
- x: 文字區塊左上角的 x 座標 (0-1，相對於圖片寬度)
- y: 文字區塊左上角的 y 座標 (0-1，相對於圖片高度)
- w: 文字區塊的寬度 (0-1，相對於圖片寬度)
- h: 文字區塊的高度 (0-1，相對於圖片高度)

類別對照：
- transportation: 交通費（計程車、高鐵、火車、公車、捷運、機票等）
- meals: 餐飲費（餐廳、便當、飲料等）
- accommodation: 住宿費（飯店、旅館等）
- equipment: 設備費（辦公用品、文具、電腦設備等）
- misc: 雜費（其他小額支出）
- other: 無法分類的項目

注意事項：
1. 金額只回傳數字，不含貨幣符號
2. 如果看到多個費用項目，請分別列出
3. 每個 ocrBlock 必須有唯一的 id
4. items 的 sourceBlockIds 必須對應到 ocrBlocks 的 id
5. confidence 為 0-1 之間的數值，表示辨識信心度
6. bbox 座標必須準確反映文字在圖片中的位置
7. 如果無法辨識某項資訊，請省略該欄位`;

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
                text: '請分析這張收據圖片，擷取所有費用項目和 OCR 文字區塊，並提供精確的 bounding box 座標：'
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
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate and format ocrBlocks
    const ocrBlocks = (extractedData.ocrBlocks || []).map((block: any, index: number) => {
      // Ensure bbox exists and has valid values
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

    // Map items to recognition items with validated source block references
    const items = (extractedData.items || []).map((item: any, index: number) => {
      // Validate sourceBlockIds - only include IDs that exist in ocrBlocks
      let sourceBlockIds = Array.isArray(item.sourceBlockIds) 
        ? item.sourceBlockIds.filter((id: string) => blockIdSet.has(id))
        : [];
      
      // If no valid sourceBlockIds, try to find related blocks
      if (sourceBlockIds.length === 0) {
        const relatedBlocks = ocrBlocks.filter((block: any) => 
          block.text.includes(String(item.amount)) || 
          block.text.includes(item.name) ||
          block.type === 'amount' ||
          block.type === 'item' ||
          block.type === 'total'
        ).slice(0, 2);
        sourceBlockIds = relatedBlocks.map((b: any) => b.id);
      }

      return {
        id: `item_${Date.now()}_${index}`,
        name: item.name || '未知項目',
        amount: Number(item.amount) || 0,
        category: item.category || 'other',
        confirmed: false,
        sourceBlockIds: sourceBlockIds.length > 0 ? sourceBlockIds : [ocrBlocks[0]?.id].filter(Boolean)
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          items,
          ocrBlocks,
          metadata: {
            vendor_name: extractedData.metadata?.vendor_name || null,
            tax_id: extractedData.metadata?.tax_id || null,
            date: extractedData.metadata?.date || null,
            total: typeof extractedData.metadata?.total === 'number' ? extractedData.metadata.total : null
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
