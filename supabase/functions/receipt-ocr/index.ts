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

    const systemPrompt = `你是一個專業的財務票據 OCR 辨識系統。請仔細分析圖片中的收據或票據，並擷取所有可見的費用項目。

請回傳以下格式的 JSON：
{
  "items": [
    {
      "name": "項目名稱（如：高鐵車票、計程車資、午餐便當等）",
      "amount": 金額數字,
      "category": "類別（transportation/meals/accommodation/equipment/misc/other）",
      "text": "原始 OCR 文字"
    }
  ],
  "ocrBlocks": [
    {
      "text": "識別出的文字內容",
      "position": "top/middle/bottom（大致位置）",
      "type": "title/date/amount/item/tax_id/total/other"
    }
  ],
  "metadata": {
    "vendor_name": "店家或供應商名稱",
    "tax_id": "統一編號（如有）",
    "date": "日期 YYYY-MM-DD（如有）",
    "total": 總金額數字
  }
}

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
3. ocrBlocks 應包含所有可辨識的文字區塊
4. 如果無法辨識某項資訊，請省略該欄位`;

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
                text: '請分析這張收據圖片，擷取所有費用項目和 OCR 文字區塊：'
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

    // Generate OCR blocks with positions for visualization
    const ocrBlocks = (extractedData.ocrBlocks || []).map((block: any, index: number) => {
      // Generate approximate bounding boxes based on position
      const positionMap: Record<string, { y: number }> = {
        'top': { y: 0.05 + index * 0.08 },
        'middle': { y: 0.35 + index * 0.08 },
        'bottom': { y: 0.65 + index * 0.08 },
      };
      const pos = positionMap[block.position] || positionMap['middle'];
      
      return {
        id: `block_${Date.now()}_${index}`,
        page: 1,
        text: block.text,
        type: block.type,
        bbox: {
          x: 0.1,
          y: Math.min(pos.y, 0.9),
          w: 0.8,
          h: 0.05
        }
      };
    });

    // Map items to recognition items with source block references
    const items = (extractedData.items || []).map((item: any, index: number) => {
      // Find related OCR blocks (blocks that contain the amount or item name)
      const relatedBlockIds = ocrBlocks
        .filter((block: any) => 
          block.text.includes(String(item.amount)) || 
          block.text.includes(item.name) ||
          block.type === 'amount' ||
          block.type === 'item'
        )
        .slice(0, 2)
        .map((block: any) => block.id);

      return {
        id: `item_${Date.now()}_${index}`,
        name: item.name,
        amount: Number(item.amount) || 0,
        category: item.category || 'other',
        confirmed: false,
        sourceBlockIds: relatedBlockIds.length > 0 ? relatedBlockIds : [ocrBlocks[0]?.id].filter(Boolean)
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          items,
          ocrBlocks,
          metadata: extractedData.metadata || {}
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
