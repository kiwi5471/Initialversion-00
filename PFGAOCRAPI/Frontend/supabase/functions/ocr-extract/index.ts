import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { imageData, filename } = await req.json();

    console.log(`Processing OCR for file: ${filename}`);

    const systemPrompt = `你是一個專業的台灣財務票據辨識系統，專精於從發票與憑證中擷取精確資訊。

### 辨識規則：
1. **供應商資訊**：必須擷取「賣方」的名稱與 8 位數字統一編號。請勿誤抓買受人資訊。
2. **日期**：若為中華民國年份 (如 113)，請自動加上 1911 轉換為西元格式 (YYYY-MM-DD)。
3. **金額**：
   - 「含稅總額」(amount_inclusive_tax) 是最終支付金額。
   - **稅額處理**：
     - 若憑證有明列「營業稅」或「VAT」，優先使用該數字。
     - 若無明列且為一般發票，請依 5% 稅率倒算：`round(含稅總額 / 1.05 * 0.05)`。
     - 注意：若標註為「免稅」或「非營業用」，稅額應為 0。
   - 「未稅金額」(amount_exclusive_tax) 為總額減去稅額。

### 細項彙整規則：
- 如果發票存在多個品項，請將其彙整為一筆主要描述，並加上「等一式」。
- `item_description` 例如：「餐飲等一式」、「生活雜物等一式」。
- 該項目的金額請直接使用總計金額。

### 輸出格式：
請以 JSON 格式回覆：
{
  "supplier_tax_id": "8位數字或null",
  "supplier_name": "供應商名稱",
  "invoice_date": "YYYY-MM-DD",
  "item_description": "品項描述或合計項目",
  "amount_exclusive_tax": 數字,
  "tax_amount": 數字,
  "amount_inclusive_tax": 數字
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "請分析這張票據並擷取財務資訊：",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageData,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "請求過於頻繁，請稍後再試" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "額度不足，請增加使用額度" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    console.log("AI Response:", content);

    // Parse the JSON response from AI
    let extractedData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          filename,
          ...extractedData,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in ocr-extract function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
