import { useCallback, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn, safeJsonParse } from "@/lib/utils";
import { getAppConfig } from "@/lib/config";
import { ExpenseEntry } from "@/types/invoice";
import { isPDF, convertPDFToImages } from "@/lib/pdfUtils";

interface FileUploaderProps {
  onFilesProcessed: (entries: ExpenseEntry[]) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  model?: string;
}

interface SelectedFile {
  file: File;
  preview: string;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const recognizeWithGPT = async (file: File, selectedModel?: string): Promise<{ entries: ExpenseEntry[], usage: any }> => {
  const config = await getAppConfig();
  const apiKey = config.apiKey;
  const model = selectedModel || config.model;

  if (!apiKey) {
    throw new Error("找不到 API Key，請檢查 public/api_config.json 或環境變數");
  }

  const base64Image = await fileToBase64(file);
  const base64Data = base64Image.split(',')[1];

  console.log(`[OCR] Sending ${file.name} to ${model}...`);

  // o 系列模型處理
  const isReasoningModel = model.startsWith("o1") || model.startsWith("o3");
  const systemRole = isReasoningModel ? "developer" : "system";

  // o3-mini 不支援 Vision
  if (model.includes("o3-mini")) {
    throw new Error("o3-mini 模型目前不支援圖片辨識 (Vision)，請改用 gpt-4o 或 o1。");
  }

  const response = await fetch('/api-openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: systemRole,
          content: `你是一個專業的台灣稅務專家與 OCR 辨識助手，專精於精確擷取台灣各種發票（包括：電子發票、三聯式/二聯式收銀機發票、三聯式/二聯式手寫發票）的資訊。

### 核心辨識邏輯：
1. **賣方資訊 (Seller Info)**：
   - **供應商名稱 (supplier_name)**：尋找位於頂部或發票章（藍色或紅色印章）中的公司名稱。
   - **供應商統編 (supplier_tax_id)**：這是「賣方」的 8 位數字。
     - *重要*：在手寫發票中，手寫的統編通常是「買受人（客戶）」，請務必從印章或印刷處尋找「賣方」統編。
2. **日期 (Date Parsing)**：
   - 格式必須為 YYYY-MM-DD。
   - **民國年轉換**：若看到 113年，請轉換為 2024 (民國年 + 1911)。
   - 若發票顯示月份區間（如 113年 9-10月），請嘗試推導具體交易日期，若無具體日期則預設為該區間的首日（如 2024-09-01）。
3. **發票號碼 (Invoice Number)**：
   - 格式為 2 碼大寫英文字軌 + 8 碼數字（如 AB-12345678），請移除連字號與空格。
4. **金額計算 (Amounts)**：
   - **總額 (total_amount)**：指含稅後的最終支付總額（客戶實際支付的錢）。
   - **判定含稅/未稅**：
     - **三聯式發票**：若有「銷售額」、「營業稅」、「總計」三個欄位，請精確讀取。
     - **二聯式/電子發票/收銀機發票**：通常「總計」即為含稅金額。
     - **免稅/零稅率**：若畫面中有標註「免稅」或「零稅率」，則稅額 (tax_amount) 必須為 0。
   - **稅額 (tax_amount) 邏輯**：
     - 優先讀取發票上明列的「營業稅」。
     - 若未明列且為一般應稅發票，請從總額倒算：[tax_amount = round(total_amount / 1.05 * 0.05)]。
     - 若為免稅項目，則為 0。
5. **細項 (Line Items) 處理規則**：
   - **簡化彙整規則**：若發票有多個細項明細（如超市、餐飲、多項雜物），**請將所有品項彙整為一筆代表性項目**即可。
   - **描述格式**：使用「[主要品項名稱] 等一式」或根據發票內容判斷類別（例如：「生活用品等一式」、「餐飲等一式」、「辦公用品等一式」）。
   - **金額一致性**：該彙整項目的金額（amount）必須等於發票的總計含稅金額（total_amount）。

### 思考過程 (Thought Process)：
在輸出 JSON 前，請先在 "thought_process" 中簡述分析邏輯。

### 輸出規範：
請僅回傳 JSON 物件。
{"invoices": [{"thought_process": "...", "supplier_name":"...", "supplier_tax_id":"...", "invoice_number":"...", "invoice_date":"...", "total_amount":0, "tax_amount":0, "items": [{"description":"...", "amount":0}]}]}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "請辨識這張圖片中的所有票據："
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      ...(isReasoningModel ? {} : { response_format: { type: "json_object" } })
    })
  });

  if (!response.ok) {
    let detail = "";
    const errText = await response.text();
    try {
      const errRes = JSON.parse(errText);
      detail = errRes.error?.message || errText;
    } catch {
      detail = errText;
    }
    console.error(`[OCR] API Error: ${response.status}`, detail);
    throw new Error(`API 錯誤 ${response.status}: ${detail.slice(0, 100)}`);
  }

  const result = await response.json();
  const data = safeJsonParse(result.choices[0].message.content);
  const invoiceList = data.invoices || [data];
  const today = new Date().toISOString().split('T')[0];

  const processedEntries: ExpenseEntry[] = [];

  for (const inv of invoiceList) {
    // 稅額保護邏輯
    let finalTaxAmount = Number(inv.tax_amount) || 0;
    const totalAmt = Number(inv.total_amount) || 0;
    if (finalTaxAmount === 0 && totalAmt > 0) {
      finalTaxAmount = Math.round(totalAmt / 1.05 * 0.05);
    }

    const items = inv.items || [];
    if (items.length === 0) {
      items.push({ description: "合計項目", amount: totalAmt });
    }

    for (const item of items) {
      processedEntries.push({
        id: crypto.randomUUID(),
        filename: file.name,
        supplier_tax_id: inv.supplier_tax_id || "",
        supplier_name: inv.supplier_name || "",
        invoice_date: inv.invoice_date || today,
        item_description: item.description || "票據明細",
        amount_exclusive_tax: (item.amount || totalAmt) - finalTaxAmount,
        tax_amount: finalTaxAmount,
        amount_inclusive_tax: item.amount || totalAmt,
        page_number: 1,
        output_type: "員工",
        payment_method: "電匯",
        expense_date: inv.invoice_date || today,
        content: item.description || "票據報銷",
        quantity: 1,
        unit_price: item.amount || totalAmt,
        currency: "TWD",
        amount: item.amount || totalAmt,
        notes: inv.thought_process || `發票號碼: ${inv.invoice_number || "無"}`,
        debit_account: "旅費",
        debit_item: "",
        debit_summary: item.description || "",
        credit_account: "應付帳款",
        credit_item: "",
        credit_summary: "",
      });
    }
  }

  return { entries: processedEntries, usage: result.usage };
};

export const FileUploader = ({ onFilesProcessed, isProcessing, setIsProcessing, model }: FileUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isConvertingPDF, setIsConvertingPDF] = useState(false);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFiles = async (files: FileList | File[]) => {
    const validFiles: SelectedFile[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (isPDF(file)) {
        setIsConvertingPDF(true);
        try {
          const pages = await convertPDFToImages(file);
          pages.forEach(page => {
            validFiles.push({
              file: page.file,
              preview: page.imageUrl
            });
          });
        } catch (err) {
          console.error("PDF conversion error:", err);
          toast({
            title: "PDF 轉換失敗",
            description: `無法轉換檔案 ${file.name}`,
            variant: "destructive",
          });
        } finally {
          setIsConvertingPDF(false);
        }
        continue;
      }

      if (!file.type.match(/^image\/(png|jpg|jpeg|gif|webp)$/)) {
        toast({
          title: "不支援的檔案格式",
          description: `檔案 ${file.name} 格式不支援。請上傳 PDF、JPG、PNG 或其他圖片格式。`,
          variant: "destructive",
        });
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "檔案過大",
          description: `檔案 ${file.name} 超過 20MB 限制。`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push({
        file,
        preview: URL.createObjectURL(file)
      });
    }

    return validFiles;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = await validateFiles(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, [toast]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      const files = await validateFiles(e.target.files);
      if (files.length > 0) {
        setSelectedFiles((prev) => [...prev, ...files]);
      }
      e.target.value = ''; // Reset input
    }
  };

  const removeFile = (index: number) => {
    const file = selectedFiles[index];
    if (file.preview.startsWith('blob:')) {
      URL.revokeObjectURL(file.preview);
    }
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "請選擇檔案",
        description: "請先選擇要上傳的票據檔案",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    const startTime = Date.now();
    const config = await getAppConfig();
    
    try {
      const allEntries: ExpenseEntry[] = [];
      let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      
      for (const item of selectedFiles) {
        // 同步備份檔案到本地資料夾
        fileToBase64(item.file).then(base64 => {
          const rawBase64 = base64.split(',')[1];
          fetch('http://127.0.0.1:3001/save-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: item.file.name, base64Data: rawBase64 })
          }).catch(err => console.error('備份檔案失敗:', err));
        });

        const { entries, usage } = await recognizeWithGPT(item.file, model);
        allEntries.push(...entries);
        if (usage) {
          totalUsage.prompt_tokens += usage.prompt_tokens || 0;
          totalUsage.completion_tokens += usage.completion_tokens || 0;
          totalUsage.total_tokens += usage.total_tokens || 0;
        }
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const logMsg = `Single/Portal Upload took ${duration}s for ${allEntries.length} entries (from ${selectedFiles.length} files). Tokens: Prompt=${totalUsage.prompt_tokens}, Completion=${totalUsage.completion_tokens}, Total=${totalUsage.total_tokens}`;
      console.log(`[OCR Performance] ${logMsg}`);
      
      // 自動傳送到日誌伺服器
      fetch('http://127.0.0.1:3001/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: logMsg })
      }).catch(err => console.error('無法傳送日誌:', err));

      onFilesProcessed(allEntries);
      
      // Cleanup previews
      selectedFiles.forEach(f => {
        if (f.preview.startsWith('blob:')) URL.revokeObjectURL(f.preview);
      });
      setSelectedFiles([]);
      setIsProcessing(false);
      
      toast({
        title: "辨識完成",
        description: `已成功透過 ${config.model} 處理 ${allEntries.length} 筆資料。`,
      });
    } catch (error: any) {
      console.error("OCR Error:", error);
      toast({
        title: "辨識失敗",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {isConvertingPDF && (
        <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">PDF 頁面解析中...</p>
          </div>
        </div>
      )}
      {!isConvertingPDF && (
        <Card
          className={cn(
            "border-2 border-dashed transition-all duration-200",
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            "p-8"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">上傳票據憑證</h3>
              <p className="text-sm text-muted-foreground">
                拖曳檔案至此處，或點擊下方按鈕選擇檔案
              </p>
              <p className="text-xs text-muted-foreground">
                支援格式：PDF、JPG、PNG（單檔最大 20MB）
              </p>
            </div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                選擇檔案
              </span>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                multiple
                accept="image/*,application/pdf"
                onChange={handleChange}
              />
            </label>
          </div>
        </Card>
      )}

      {selectedFiles.length > 0 && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">已選擇的檔案 ({selectedFiles.length})</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedFiles.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border bg-muted/50 p-2 text-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-12 h-12 rounded bg-white flex-shrink-0 border overflow-hidden">
                      <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{item.file.name}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {(item.file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8 p-0 hover:bg-accent hover:text-destructive flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              onClick={handleUpload}
              disabled={isProcessing}
              className="w-full mt-4 flex items-center gap-2"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {isProcessing ? "正在辨識中..." : `開始辨識 (${selectedFiles.length} 個附件)`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
