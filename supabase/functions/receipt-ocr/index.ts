import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const systemPrompt = `你是一個專業的台灣財務票據 OCR 辨識系統，專精於台灣統一發票、電子發票、收據的辨識。

【核心任務】
仔細分析圖片中的發票或收據，精確擷取所有費用明細。

【台灣發票格式知識】
1. 電子發票證明聯：
   - 發票號碼格式：2碼英文 + 8碼數字（如 AB12345678）
   - 通常有 QR Code 或條碼
   - 會標示「電子發票證明聯」
   - 賣方資訊通常在底部

2. 三聯式發票：
   - 手開或機打
   - 有「存根聯」「扣抵聯」「收執聯」
   - 明確標示賣方、買方資訊

3. 二聯式發票：
   - 常見於便利商店、超市、停車場
   - 較簡易的格式

【重要】賣方與買方辨識規則：
- vendor（廠商）：必須是「賣方」/「銷售人」/「營業人」的名稱
- tax_id（統編）：必須是「賣方」的統一編號（8碼純數字）
- 發票通常標示「賣方」或「營業人」欄位
- 「買方」/「買受人」是客戶資訊，請忽略

【金額辨識規則】
- 台灣發票稅率通常為 5%
- 含稅金額 = 未稅金額 × 1.05
- 進項稅額 = 含稅金額 - 未稅金額
- 注意「小計」「合計」「總計」「應付金額」等字眼
- 金額可能有千分位逗號（如 1,234）

【日期格式轉換】
- 民國年轉西元年：民國年 + 1911 = 西元年
- 「112年9月8日」→「2023-09-08」
- 「113/01/15」→「2024-01-15」

【發票號碼清理規則】
- 移除空格、連字號
- 確保格式為 2碼英文 + 8碼數字
- 例：「RY 337-24453」→「RY33724453」

【輸出限制】
- ocrBlocks 最多 30 個區塊
- sourceBlockIds 每個 lineItem 最多 5 個
- 輸出必須是完整有效的 JSON

請回傳以下格式的 JSON：

{
  "lineItems": [
    {
      "id": "line_001",
      "category": "0",
      "vendor": "賣方廠商名稱",
      "tax_id": "賣方統一編號（8碼純數字，無則為 null）",
      "date": "YYYY-MM-DD",
      "invoice_number": "發票號碼（2碼英文+8碼數字，如 AB12345678）",
      "amount_with_tax": 含稅金額數字,
      "input_tax": 進項稅額數字,
      "editable": true,
      "sourceBlockIds": ["b_001", "b_002"]
    }
  ],
  "ocrBlocks": [
    {
      "id": "b_001",
      "page": 1,
      "text": "識別出的文字",
      "type": "amount",
      "confidence": 0.95,
      "bbox": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05 }
    }
  ],
  "metadata": {
    "vendor": "賣方廠商名稱",
    "tax_id": "賣方統一編號",
    "date": "YYYY-MM-DD",
    "total_amount": 總金額數字
  }
}

【category 憑證種類代碼】
- 0: 電子發票（有 QR Code 或條碼）
- 1: 三聯式手開發票
- 2: 三聯式收銀機發票
- 3: 二聯式收銀機發票（含機票、車票、水電費收據）
- 4: 進貨折讓證明單
- 5: 海關進出口貨物稅費繳納證
- 6: 三聯式零稅率發票
- 7: 進貨零稅率折讓證明單
- 8: 海關進口代徵退還溢繳營業稅
- 9: 境外電商及不得扣抵之電子發票

【ocrBlocks type 類型】
title/vendor/date/amount/item/tax_id/total/subtotal/tax/invoice_number/other

【bbox 座標】0-1 正規化座標`;

    const requestBody = {
      model: 'openai/gpt-5',
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
      max_completion_tokens: 4096,
    };

    // Retry OpenAI calls on 429 to reduce client-visible failures.
    const MAX_ATTEMPTS = 4; // 1 initial + 3 retries
    let response: Response | null = null;
    let lastErrorText = '';

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;

      // If rate-limited, wait and retry.
      if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
        lastErrorText = await response.text();
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))
          ? Math.max(1, Number(retryAfterHeader)) * 1000
          : (1500 * Math.pow(2, attempt)); // 1.5s, 3s, 6s, ...

        console.warn(
          `OpenAI rate limited (429). attempt ${attempt + 1}/${MAX_ATTEMPTS}. waiting ${retryAfterMs}ms.`,
        );
        await sleep(retryAfterMs);
        continue;
      }

      // Non-429 errors: keep body for diagnostics and stop retrying.
      lastErrorText = await response.text();
      break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 500;

      // IMPORTANT: Return 200 so the web client doesn't treat this as a hard network failure.
      // We surface the actual code in JSON as `code`.
      if (status === 429) {
        return new Response(
          JSON.stringify({ success: false, code: 429, error: '請求過於頻繁，請稍後再試' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ success: false, code: 402, error: '額度不足，請增加使用額度' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('OpenAI error:', status, lastErrorText);
      throw new Error(`OpenAI error: ${status}`);
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
          block.text.includes(String(item.amount_with_tax)) || 
          block.text.includes(item.invoice_number) ||
          block.type === 'amount' ||
          block.type === 'invoice_number' ||
          block.type === 'total'
        ).slice(0, 2);
        sourceBlockIds = relatedBlocks.map((b: any) => b.id);
      }

      // Validate tax_id - must be 8 digits only
      let taxId = item.tax_id || metadataTaxId;
      if (taxId && !/^\d{8}$/.test(taxId)) {
        taxId = null;
      }

      // Parse amount_with_tax
      const amountWithTax = typeof item.amount_with_tax === 'number' 
        ? item.amount_with_tax 
        : (typeof item.amount === 'number' ? item.amount : Number(item.amount_with_tax || item.amount) || 0);
      
      // Parse input_tax (default to 5% of amount if not provided)
      const inputTax = typeof item.input_tax === 'number' 
        ? item.input_tax 
        : Math.round(amountWithTax - amountWithTax / 1.05);

      // Clean and validate invoice_number - must be 2 letters + 8 digits
      let invoiceNumber = item.invoice_number || null;
      if (invoiceNumber) {
        // Remove dashes, spaces, and other non-alphanumeric characters
        invoiceNumber = invoiceNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        // Validate format: 2 letters + 8 digits
        if (!/^[A-Z]{2}\d{8}$/.test(invoiceNumber)) {
          // Try to extract valid pattern from the string
          const match = invoiceNumber.match(/([A-Z]{2})(\d{8})/);
          invoiceNumber = match ? match[1] + match[2] : null;
        }
      }

      return {
        id: item.id || `line_${String(index + 1).padStart(3, '0')}`,
        category: item.category || '0',
        vendor: item.vendor || metadataVendor || '未知廠商',
        tax_id: taxId,
        date: item.date || extractedData.metadata?.date || null,
        invoice_number: invoiceNumber,
        amount_with_tax: String(amountWithTax),
        input_tax: String(inputTax),
        editable: true,
        sourceBlockIds: sourceBlockIds.length > 0 ? sourceBlockIds : [ocrBlocks[0]?.id].filter(Boolean)
      };
    });

    // If no lineItems but we have a total, create one line item
    if (lineItems.length === 0 && extractedData.metadata?.total_amount) {
      const totalBlocks = ocrBlocks.filter((b: any) => b.type === 'total' || b.type === 'amount');
      const totalAmount = extractedData.metadata.total_amount;
      lineItems.push({
        id: 'line_001',
        category: '0',
        vendor: metadataVendor || '未知廠商',
        tax_id: metadataTaxId,
        date: extractedData.metadata?.date || null,
        invoice_number: null,
        amount_with_tax: String(totalAmount),
        input_tax: String(Math.round(totalAmount - totalAmount / 1.05)),
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
