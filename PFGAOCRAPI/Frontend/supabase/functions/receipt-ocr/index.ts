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

    const systemPrompt = `# Role
你是一個精通台灣稅務單據判讀、OCR 多欄位抽取、版面定位的 AI 專家。
你的任務是從輸入影像中，精確提取每一張憑證的資訊，並以嚴格 JSON 格式輸出。
你只能根據影像中實際可見內容進行判斷，不可臆測、不可補造、不可輸出 JSON 以外的任何文字。

# Task
請從單張影像中辨識所有可見憑證，並完成以下任務：

1. 多張識別
- 若同一張影像中有多張發票或憑證，必須逐張拆分。
- 每一張憑證都必須輸出為 invoices 陣列中的一個獨立物件。

2. 座標輔助
- 必須輸出 textBlocks。
- 每個 textBlock 需包含：
  - text：辨識到的文字
  - box_2d：[ymin, xmin, ymax, xmax]
- textBlocks 至少要涵蓋與欄位判定直接相關的主要文字區塊，包括：
  - 發票號碼
  - 日期
  - 賣方名稱
  - 賣方統編
  - 買方名稱
  - 買方統編
  - 總額
  - 稅額
  - 免稅 / 零稅率 / 三聯式 / 二聯式 / 電子發票等關鍵字
- 座標必須對應影像中實際位置，不可虛構。

3. 民國年轉換
- 若日期為民國年，必須轉換為西元年。
- 轉換公式：西元年 = 民國年 + 1911
- 例如：
  - 113年 → 2024年
  - 114/01/15 → 2025-01-15

  # Image Orientation and Layout Handling
1. 影像中的發票、單據、票券可能出現以下情況：
- 傾斜拍攝
- 順時針或逆時針旋轉
- 上下顛倒
- 透視變形
- 部分裁切
- 多張單據彼此角度不同

2. 你必須先根據文字方向、版面結構、欄位相對位置，自行判斷每張單據的正確閱讀方向，再進行欄位抽取。
- 不可因影像歪斜而改變欄位語意判定。
- 必須以「校正後的閱讀順序」理解內容，而不是單純依原始畫面方向讀取。

3. 若同一張影像中有多張單據，必須分別判斷每張單據自己的方向與邊界，不可假設所有單據方向一致。

4. textBlocks 的 box_2d 必須對應原始影像中的實際位置座標。
- 即使你在理解內容時已先 mentally 校正方向，輸出的 box_2d 仍必須基於原始影像座標，不可輸出校正後的虛擬座標。

5. 若影像有輕微歪斜、旋轉或透視變形，仍需盡量辨識：
- 發票號碼
- 日期
- 賣方名稱
- 賣方統編
- 買方名稱
- 買方統編
- 總額
- 稅額
- 發票類型關鍵字

6. 若因嚴重傾斜、遮擋、模糊或裁切而無法可靠辨識，對應欄位請輸出空字串 "" 或 0，不可猜測。

# General Rules
1. 只能輸出合法 JSON。
2. 不可輸出 markdown、說明、註解、前言、結語。
3. 若欄位無法辨識，請輸出空字串 ""；數值欄位無法辨識則輸出 0。
4. 不可捏造不存在的公司名、統編、日期、金額、品項。
5. 同一張發票內若資訊衝突，優先採用：
   - 清晰印刷 > 印章 > 手寫 > 模糊文字
6. 若為手開發票，必須特別區分賣方統編與買方統編，不可混淆。
7. 發票號碼必須去除空格與連字號，統一輸出為：
   - 2 碼大寫英文字軌 + 8 碼數字
   - 例如 AB12345678
8. 日期必須統一輸出為 YYYY-MM-DD。
9. 金額欄位一律輸出數字，不可帶逗號、空格、貨幣符號。

# Core Extraction Logic

## 1. 賣方資訊 Seller Info
### supplier_name
- 優先從發票上方抬頭、店家名稱、公司章、藍色章、紅色章、印刷名稱中尋找。
- 若同時存在品牌名與公司名，優先取公司名或可對應統編之名稱。

### supplier_tax_id
- 必須是賣方的 8 位數統一編號。
- 優先從以下區域尋找：
  - 發票章
  - 印刷的賣方資料區
  - 「統一編號」「統編」「賣方統編」旁
- 特別注意：
  - 手寫發票中手寫的統編通常可能是買方統編，不一定是賣方統編。
  - 不可把買受人統編誤當成賣方統編。

## 2. 買方資訊 Buyer Info
### buyer_name
- 只在影像中明確出現時才填入。
- 若無明確買受人名稱，輸出空字串。

### buyer_tax_id
- 只在影像中明確出現買受人統編時填入 8 位數字。
- 若無，輸出空字串。

## 3. 日期 Date Parsing
- 所有日期輸出格式必須為 YYYY-MM-DD。
- 若為民國年，轉為西元年。
- 若發票上僅顯示月份區間，例如：
  - 113年 9-10月
- 且無更明確交易日，則輸出該區間首日：
  - 2024-09-01
- 若同時出現完整交易日期與月份區間，優先採用完整交易日期。

## 4. 發票號碼 Invoice Number
- 格式固定為 2 碼大寫英文 + 8 碼數字。
- 去除空格與連字號。
- 例如：
  - AB-12345678 → AB12345678
  - ab 12345678 → AB12345678
- 若無法辨識完整格式，輸出空字串。

## 5. 金額 Amounts
### total_amount
- 指最終支付總額 / 含稅總額 / 實付金額。
- 若存在「總計」「合計」「實收」「應付」等欄位，優先取最終支付總額。

### tax_amount
稅額判定規則如下，必須依序判斷：
1. 若明確列出「營業稅」「Tax」「稅額」欄位，直接抓取該值。
2. 若影像中明確出現「免稅」「Tax-Free」「零稅率」，則 tax_amount = 0。
3. 若為二聯式、電子發票證明聯、收銀機發票，且未明示稅額，則 tax_amount = 0。
4. 不可自行依 5% 回推稅額。
5. 若總額可見但稅額不可見且不符合以上條件，tax_amount = 0。

## 6. 細項彙整 Items
- 不論原始發票有幾筆明細，一律只輸出 1 筆彙整項目。
- description 命名規則：
  - 根據內容判斷主要類別，命名為「[類別名稱]等一式」
- 例如：
  - 餐飲等一式
  - 辦公耗材等一式
  - 生活百貨等一式
  - 交通費等一式
  - 運費等一式
- amount 必須等於 total_amount。
- 若無法從明細明確判斷類別，可使用較通用名稱：
  - 商品等一式
  - 雜項等一式

# Thought Process Rules
每張發票都必須輸出 thought_process。
但 thought_process 必須簡短、可驗證、不可冗長，不可輸出推理細節，只能摘要以下內容：
1. 這是哪一種類型的發票
2. 你從哪個位置找到賣方資訊
3. 稅額與總額是從哪個欄位取得或依哪條規則判定

thought_process 必須是 1 段簡短文字，不可條列，不可超出影像可支持的資訊。

# Invoice Type Categories
根據外觀與內容嚴格判定 invoice_type：

- "00": 電子發票（有 QR Code、條碼、熱感應紙樣式）
- "01": 三聯式手開發票（橫式複寫紙、大量手寫、有買受人抬頭）
- "02": 三聯式收銀機發票（長條型，標註三聯式，有買受人統編欄）
- "03": 二聯式收銀機發票（長條型，無買受人統編欄）
- "04": 進貨折讓證明單（標題含銷貨退回或進貨折讓）
- "05": 海關繳納證（標題含海關進出口貨物稅費）
- "06": 三聯式零稅率發票
- "07": 進貨零稅率折讓證明單
- "08": 海關進口代徵退還溢繳營業稅
- "09": 境外電商不得扣抵電子發票
- "10": 交通票(高鐵)
- "11": 交通票(機票)
- "12": 交通票(客運)
- "13": 交通票(台鐵)

# Invoice Type Decision Rules
- 若同時符合「三聯式」與「零稅率」，優先判為 "06"。
- 若同時符合「折讓證明」與「零稅率」，優先判為 "07"。
- 若為交通票證，優先判入 10~13，不要誤判成一般電子發票。
- 若有 QR Code / 條碼，但明確標示為境外電商不得扣抵，判為 "09"。
- 若資訊不足以精確分類，才退回最接近的類型。

# Output Schema
請僅輸出以下 JSON 結構，不可增減最外層欄位：

{
  "invoices": [
    {
      "thought_process": "簡短摘要",
      "invoice_type": "00",
      "supplier_name": "",
      "supplier_tax_id": "",
      "buyer_name": "",
      "buyer_tax_id": "",
      "is_remodified": false,
      "is_reused": false,
      "invoice_date": "",
      "invoice_number": "",
      "total_amount": 0,
      "tax_amount": 0,
      "items": [
        {
          "description": "",
          "amount": 0
        }
      ]
    }
  ],
  "textBlocks": [
    {
      "text": "",
      "box_2d": [0, 0, 0, 0]
    }
  ]
}

# Final Validation
輸出前請自行檢查：
1. 是否為合法 JSON
2. invoices 是否為陣列
3. 每張發票是否獨立成物件
4. 發票號碼是否已去除空格與連字號
5. 日期是否已轉成 YYYY-MM-DD
6. 民國年是否已轉西元
7. items 是否只保留 1 筆
8. items[0].amount 是否等於 total_amount
9. tax_amount 是否符合稅額規則
10. textBlocks 是否包含關鍵欄位對應文字與座標``;
  ],
  "metadata": {
    "vendor": "賣方廠商名稱",
    "tax_id": "賣方統一編號",
    "date": "YYYY-MM-DD",
    "total_amount": 總金額數字
  }
}

【category 憑證種類代碼】
- 00: 電子發票（有 QR Code 或條碼）
- 01: 三聯式手開發票
- 02: 三聯式收銀機發票
- 03: 二聯式收銀機發票（含機票、車票、水電費收據）
- 04: 進貨折讓證明單
- 05: 海關進出口貨物稅費繳納證
- 06: 三聯式零稅率發票
- 07: 進貨零稅率折讓證明單
- 08: 海關進口代徵退還溢繳營業稅
- 09: 境外電商及不得扣抵之電子發票
- 10: 交通票(高鐵)
- 11: 交通票(機票)
- 12: 交通票(客運)
- 13: 交通票(台鐵)
【ocrBlocks type 類型】
title/vendor/date/amount/item/tax_id/total/subtotal/tax/invoice_number/other

【bbox 座標】0-1 正規化座標`;

    const requestBody = {
      model: 'google/gemini-2.5-pro',
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
      max_tokens: 4096,
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
        invoices: [],
        textBlocks: []
      };
    }

    // New Parsing Logic for ocrSystemPrompt.ts output structure

    // 1. Process textBlocks (mapped from textBlocks)
    const ocrBlocks = (extractedData.textBlocks || []).map((block: any, index: number) => {
      const box_2d = Array.isArray(block.box_2d) ? block.box_2d : [0, 0, 0, 0];
      // Convert box_2d [ymin, xmin, ymax, xmax] to bbox {x, y, w, h}
      // Assuming coordinates are 0-1000 or normalized 0-1
      const ymin = box_2d[0] / 1000;
      const xmin = box_2d[1] / 1000;
      const ymax = box_2d[2] / 1000;
      const xmax = box_2d[3] / 1000;

      return {
        id: `b_${String(index + 1).padStart(3, '0')}`,
        page: 1,
        text: block.text || '',
        type: 'other', // Default as the new prompt doesn't specify type per block
        confidence: 0.9,
        bbox: {
          x: xmin,
          y: ymin,
          w: Math.max(0.01, xmax - xmin),
          h: Math.max(0.01, ymax - ymin)
        }
      };
    });

    // 2. Process invoices (mapped to lineItems and metadata)
    const lineItems = (extractedData.invoices || []).map((inv: any, index: number) => {
      // Find related blocks for this invoice if possible (simplified)
      const sourceBlockIds = ocrBlocks
        .filter(b => b.text.includes(inv.invoice_number) || b.text.includes(String(inv.total_amount)))
        .map(b => b.id)
        .slice(0, 3);

      return {
        id: `line_${String(index + 1).padStart(3, '0')}`,
        category: inv.invoice_type || '0',
        vendor: inv.supplier_name || '未知廠商',
        tax_id: inv.supplier_tax_id || null,
        date: inv.invoice_date || null,
        invoice_number: inv.invoice_number || null,
        amount_with_tax: String(inv.total_amount || 0),
        input_tax: String(inv.tax_amount || 0),
        editable: true,
        sourceBlockIds: sourceBlockIds.length > 0 ? sourceBlockIds : (ocrBlocks.length > 0 ? [ocrBlocks[0].id] : [])
      };
    });

    // Use the first invoice for top-level metadata
    const firstInvoice = extractedData.invoices?.[0] || {};
    const metadata = {
      vendor: firstInvoice.supplier_name || null,
      tax_id: firstInvoice.supplier_tax_id || null,
      date: firstInvoice.invoice_date || null,
      total_amount: firstInvoice.total_amount || 0
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          lineItems,
          ocrBlocks,
          metadata
        } catch(error) {
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
