import { useState, useCallback, useMemo } from "react";
import { LineItem, OCRBlock } from "@/types/recognition";
import { FileProcessingResult, UploadedFileItem, ExportData, ExportedLineItem } from "@/types/batch";
import { ReceiptUploader } from "@/components/ReceiptUploader";
import { UploadFileList } from "@/components/UploadFileList";
import { RecognitionItemList } from "@/components/RecognitionItemList";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { BatchFileList } from "@/components/BatchFileList";
import { ExportButtons } from "@/components/ExportButtons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Play, Loader2, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAppConfig } from "@/lib/config";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { safeJsonParse } from "@/lib/utils";

type Step = 'upload' | 'result';

export default function ReceiptRecognition() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  
  // Step 1 state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  
  // Step 2 state
  const [processedFiles, setProcessedFiles] = useState<FileProcessingResult[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);
  const [activeBlockIds, setActiveBlockIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");

  // Developer Mode States
  const [mode, setMode] = useState<"user" | "dev">("user");
  const [devConfig, setDevConfig] = useState({
    folderPath: "",
    iterations: 1,
  });

  const runDevProcess = async () => {
    if (!devConfig.folderPath) {
      toast({ title: "請輸入資料夾路徑", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    try {
      const scanRes = await fetch("http://127.0.0.1:3001/scan-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath: devConfig.folderPath }),
      });

      if (!scanRes.ok) {
        const err = await scanRes.json();
        throw new Error(err.error || "掃描失敗");
      }

      const { files } = await scanRes.json();
      if (files.length === 0) {
        toast({ title: "資料夾內無支援的檔案", description: "支援: pdf, jpg, jpeg, png" });
        setIsProcessing(false);
        return;
      }

      const config = await getAppConfig();
      const startTime = Date.now();

      for (let i = 0; i < devConfig.iterations; i++) {
        for (let j = 0; j < files.length; j++) {
          const fileData = files[j];
          const fileStartTime = Date.now();
          
          if (fileData.isActualPdf) {
            const logMsg = `[DevMode] Iteration ${i+1}, File: ${fileData.fileName} | Status: Skipped (Original PDF not supported in DevMode) | Took: 0s`;
            console.warn(logMsg);
            fetch("http://127.0.0.1:3001/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: logMsg })
            }).catch(() => {});
            continue;
          }

          try {
            if (selectedModel.includes("o3-mini")) {
              throw new Error("o3-mini 不支援圖片辨識，請切換至 gpt-4o 或 o1");
            }
            const isReasoningModel = selectedModel.startsWith("o1") || selectedModel.startsWith("o3");
            const systemRole = isReasoningModel ? "developer" : "system";

            const resp = await fetch("/api-openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`
              },
              body: JSON.stringify({
                model: selectedModel,
                messages: [
                  { role: systemRole, content: "你是一個專業的 OCR 辨識助手。請僅回傳 JSON 格式。" },
                  { role: "user", content: [
                    { type: "text", text: "請辨識這張圖片內容並回傳 JSON 格式結果。" },
                    { type: "image_url", image_url: { url: fileData.base64Data } }
                  ]}
                ],
                ...(isReasoningModel ? {} : { response_format: { type: "json_object" } })
              })
            });

            const duration = (Date.now() - fileStartTime) / 1000;
            let statusText = resp.ok ? "Success" : `Error ${resp.status}`;
            let detail = null;
            
            if (!resp.ok) {
              const errBody = await resp.json().catch(() => ({}));
              statusText = `Error ${resp.status}: ${errBody.error?.message || "Unknown Error"}`;
            } else {
              const result = await resp.json();
              const content = result.choices?.[0]?.message?.content;
              if (!content) {
                statusText = "Empty Result";
              } else {
                try {
                  detail = safeJsonParse(content);
                } catch (e) {
                  detail = content;
                }
              }
            }

            const logMsg = `[DevMode] Iteration ${i+1}, File: ${fileData.fileName} | Status: ${statusText} | Took: ${duration}s`;
            console.log(logMsg);

            fetch("http://127.0.0.1:3001/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: logMsg, detail: detail })
            }).catch(() => {});

          } catch (e: any) {
            const duration = (Date.now() - fileStartTime) / 1000;
            const logMsg = `[DevMode] Iteration ${i+1}, File: ${fileData.fileName} | Status: Failed (${e.message}) | Took: ${duration}s`;
            fetch("http://127.0.0.1:3001/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: logMsg })
            }).catch(() => {});
          }
          
          setProgress(Math.round(((i * files.length + (j + 1)) / (devConfig.iterations * files.length)) * 100));
        }
      }

      const totalDuration = (Date.now() - startTime) / 1000;
      toast({ title: "開發者模式執行完畢", description: `總計耗時 ${totalDuration}s` });

    } catch (error: any) {
      toast({ title: "執行失敗", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const activeFile = useMemo(
    () => processedFiles.find(f => f.id === activeFileId) || null,
    [processedFiles, activeFileId]
  );

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  // Delay helper for rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Process file with direct OpenAI GPT-4o call
  const processFileWithRetry = async (
    fileResult: FileProcessingResult, 
    file: File, 
    maxRetries: number = 3
  ): Promise<FileProcessingResult> => {
    const config = await getAppConfig();
    const apiKey = config.apiKey;
    const model = selectedModel || config.model;

    if (!apiKey) {
      throw new Error("找不到 API Key，請檢查 public/api_config.json 或環境變數");
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const imageData = await fileToBase64(file);
        const base64Data = imageData.split(',')[1];

        console.log(`[OCR] Sending batch file ${file.name} to ${model}...`);

        if (model.includes("o3-mini")) {
          throw new Error("o3-mini 不支援圖片辨識，請改用 gpt-4o 或 o1");
        }

        const isReasoningModel = model.startsWith("o1") || model.startsWith("o3");
        const systemRole = isReasoningModel ? "developer" : "system";

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
   - *注意*：我們不需要每一筆餅乾或汽水的細節，只需要一筆總結項目。

### 思考過程 (Thought Process)：
在輸出 JSON 前，請先在 "thought_process" 中簡述：
- 這是哪種類型的發票？
- 你在哪個位置找到了發票章或賣方資訊？
- 你是如何計算或確認稅額與總額的？

### 輸出規範：
請嚴格遵守 JSON 格式。若某個欄位資訊完全不存在，請填入 null。

{"invoices": [{"thought_process": "分析過程敘述...", "supplier_name":"名稱", "supplier_tax_id":"8位數字", "invoice_number":"XY12345678", "invoice_date":"YYYY-MM-DD", "total_amount":數字, "tax_amount":數字, "items": [{"description":"品項名稱", "amount":數字}]}]}`
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "請辨識這張圖片中的所有發票與細項："
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
            const errBody = JSON.parse(errText);
            detail = errBody.error?.message || errText;
          } catch {
            detail = errText;
          }
          console.error(`[OCR] Batch API Error: ${response.status}`, detail);
          throw new Error(`API 錯誤 ${response.status}: ${detail.slice(0, 100)}`);
        }

        const result = await response.json();
        console.log(`[OCR] Received response for batch item ${file.name}`, result.usage);
        
        const data = safeJsonParse(result.choices[0].message.content);
        const invoiceList = data.invoices || [data]; // 支援多發票或單發票格式

        const allLineItems: any[] = [];
        
        for (const content of invoiceList) {
          // 稅額保護邏輯：如果 AI 沒抓到稅額但有總額，嘗試計算 5%
          let finalTaxAmount = Number(content.tax_amount) || 0;
          const totalAmt = Number(content.total_amount) || 0;
          if (finalTaxAmount === 0 && totalAmt > 0) {
            finalTaxAmount = Math.round(totalAmt / 1.05 * 0.05);
            console.log(`[OCR] 自動補算稅額: ${finalTaxAmount} (基於總額 ${totalAmt})`);
          }

          const items = (content.items || []).map((item: any) => ({
            id: crypto.randomUUID(),
            category: "0",
            vendor: content.supplier_name || "",
            tax_id: content.supplier_tax_id || "",
            date: content.invoice_date || null,
            invoice_number: content.invoice_number || null,
            amount_with_tax: String(item.amount || item.amount_with_tax || 0),
            input_tax: String(finalTaxAmount),
            editable: true,
            confirmed: false,
            sourceBlockIds: [],
            description: item.description || "",
          }));

          if (items.length === 0 && content.supplier_name) {
            items.push({
              id: crypto.randomUUID(),
              category: "0",
              vendor: content.supplier_name || "",
              tax_id: content.supplier_tax_id || "",
              date: content.invoice_date || null,
              invoice_number: content.invoice_number || null,
              amount_with_tax: String(content.total_amount || 0),
              input_tax: String(finalTaxAmount),
              editable: true,
              confirmed: false,
              sourceBlockIds: [],
              description: "合計項目"
            });
          }
          allLineItems.push(...items);
        }

        return {
          ...fileResult,
          status: 'success',
          lineItems: allLineItems,
          ocrBlocks: [], 
          metadata: {
            supplier_name: invoiceList[0]?.supplier_name,
            supplier_tax_id: invoiceList[0]?.supplier_tax_id,
            invoice_date: invoiceList[0]?.invoice_date,
          },
          usage: result.usage
        };
      } catch (error) {
        console.error(`OCR error (attempt ${attempt + 1}):`, error);
        lastError = error instanceof Error ? error : new Error('辨識失敗');
        
        if (lastError.message?.includes('429')) {
          const waitTime = Math.pow(2, attempt) * 2000;
          await delay(waitTime);
          continue;
        }
        break;
      }
    }
    
    return {
      ...fileResult,
      status: 'error',
      error: lastError?.message || '辨識失敗',
    };
  };

  // Step 1 handlers
  const handleFilesAdd = useCallback((files: UploadedFileItem[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.imageUrl);
      }
      return prev.filter(f => f.id !== fileId);
    });
  }, []);

  const handleStartRecognition = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    // Initialize file results
    const initialResults: FileProcessingResult[] = uploadedFiles.map(uf => ({
      id: uf.id,
      fileName: uf.fileName,
      imageUrl: uf.imageUrl,
      status: 'pending' as const,
      lineItems: [],
      ocrBlocks: [],
    }));

    setProcessedFiles(initialResults);
    setActiveFileId(initialResults[0]?.id || null);
    setStep('result');
    setIsProcessing(true);

    const startTime = Date.now();

    // Process files one by one with shorter delay for gpt-4o-mini
    const results = [...initialResults];
    const REQUEST_DELAY_MS = 500; // Reduced from 1500ms to 500ms
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    for (let i = 0; i < uploadedFiles.length; i++) {
      // Update status to processing
      results[i] = { ...results[i], status: 'processing' };
      setProcessedFiles([...results]);

      // Add delay between requests (except for the first one)
      if (i > 0) {
        await delay(REQUEST_DELAY_MS);
      }

      // Process the file with retry logic
      const fileItem = uploadedFiles[i];
      
      // 同步備份檔案到本地資料夾
      fileToBase64(fileItem.file).then(base64 => {
        const rawBase64 = base64.split(',')[1];
        fetch('http://127.0.0.1:3001/save-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: fileItem.fileName, base64Data: rawBase64 })
        }).catch(err => console.error('備份檔案失敗:', err));
      });

      const result = await processFileWithRetry(results[i], fileItem.file);
      results[i] = result;
      if (result.usage) {
        totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += result.usage.completion_tokens || 0;
        totalUsage.total_tokens += result.usage.total_tokens || 0;
      }
      setProcessedFiles([...results]);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const logMsg = `Batch Recognition took ${duration}s for ${uploadedFiles.length} files. Tokens: Prompt=${totalUsage.prompt_tokens}, Completion=${totalUsage.completion_tokens}, Total=${totalUsage.total_tokens}`;
    console.log(`[OCR Performance] ${logMsg}`);

    // 自動傳送到日誌伺服器
    fetch('http://127.0.0.1:3001/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: logMsg })
    }).catch(err => console.error('無法傳送日誌:', err));

    setIsProcessing(false);

    const successCount = results.filter(f => f.status === 'success').length;
    const totalItems = results.reduce((sum, f) => sum + f.lineItems.length, 0);

    toast({
      title: "批次辨識完成",
      description: `${successCount}/${results.length} 個檔案成功，共識別 ${totalItems} 筆項目`,
    });
  }, [uploadedFiles, toast]);

  // Step 2 handlers
  const handleReset = useCallback(() => {
    // Cleanup blob URLs
    uploadedFiles.forEach(f => {
      if (f.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.imageUrl);
      }
    });
    processedFiles.forEach(f => {
      if (f.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.imageUrl);
      }
    });

    setUploadedFiles([]);
    setProcessedFiles([]);
    setActiveFileId(null);
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
    setStep('upload');
  }, [uploadedFiles, processedFiles]);

  const handleFileSelect = useCallback((fileId: string) => {
    // Prevent switching files while editing
    if (isEditing) return;
    
    setActiveFileId(fileId);
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, [isEditing]);

  const handleItemClick = useCallback((item: LineItem) => {
    setActiveItemId(item.id);
    setActiveBlockIds(item.sourceBlockIds);
    setHighlightedItemIds([]);
  }, []);

  const handleItemAdd = useCallback(() => {
    if (!activeFileId) return;
    
    const newItem: LineItem = {
      id: `line_new_${Date.now()}`,
      category: "0",
      vendor: "",
      tax_id: null,
      date: null,
      invoice_number: null,
      amount_with_tax: "0",
      input_tax: "0",
      editable: true,
      confirmed: false,
      sourceBlockIds: [],
    };

    setProcessedFiles((prev) =>
      prev.map((file) =>
        file.id === activeFileId
          ? { ...file, lineItems: [newItem, ...file.lineItems] }
          : file
      )
    );
  }, [activeFileId]);

  const handleBlockClick = useCallback((blockId: string) => {
    if (!activeFile) return;
    const relatedItems = activeFile.lineItems.filter((item) =>
      item.sourceBlockIds.includes(blockId)
    );
    const relatedItemIds = relatedItems.map((item) => item.id);
    
    setHighlightedItemIds(relatedItemIds);
    setActiveBlockIds([blockId]);
    setActiveItemId(null);
  }, [activeFile]);

  const handleEmptyClick = useCallback(() => {
    setActiveItemId(null);
    setActiveBlockIds([]);
    setHighlightedItemIds([]);
  }, []);

  const handleItemUpdate = useCallback(
    (id: string, updates: Partial<LineItem>) => {
      if (!activeFileId) return;
      setProcessedFiles((prev) =>
        prev.map((file) => 
          file.id === activeFileId
            ? {
                ...file,
                lineItems: file.lineItems.map((item) =>
                  item.id === id ? { ...item, ...updates } : item
                ),
              }
            : file
        )
      );
    },
    [activeFileId]
  );

  const handleItemDelete = useCallback((id: string) => {
    if (!activeFileId) return;
    setProcessedFiles((prev) =>
      prev.map((file) =>
        file.id === activeFileId
          ? {
              ...file,
              lineItems: file.lineItems.filter((item) => item.id !== id),
            }
          : file
      )
    );
    if (activeItemId === id) {
      setActiveItemId(null);
      setActiveBlockIds([]);
    }
  }, [activeFileId, activeItemId]);

  const handleItemConfirm = useCallback((id: string) => {
    if (!activeFileId) return;
    setProcessedFiles((prev) =>
      prev.map((file) =>
        file.id === activeFileId
          ? {
              ...file,
              lineItems: file.lineItems.map((item) =>
                item.id === id ? { ...item, confirmed: !item.confirmed } : item
              ),
            }
          : file
      )
    );
  }, [activeFileId]);

  const totalAmount = activeFile?.lineItems.reduce((sum, item) => sum + (parseFloat(item.amount_with_tax) || 0), 0) || 0;

  // Export data
  const exportData: ExportData = useMemo(() => {
    const successFiles = processedFiles.filter(f => f.status === 'success');
    const allItems: ExportedLineItem[] = successFiles.flatMap(f => 
      f.lineItems.map(item => {
        const amountWithTax = parseFloat(item.amount_with_tax) || 0;
        const inputTax = parseFloat(item.input_tax) || 0;
        const amountWithoutTax = amountWithTax - inputTax;
        
        return {
          name: item.invoice_number,
          category: item.category,
          tax_id: item.tax_id,
          vendor: item.vendor,
          date: item.date,
          amount_without_tax: String(amountWithoutTax),
          tax_amount: item.input_tax,
          amount_with_tax: item.amount_with_tax,
          scanned_filename: f.fileName,
          file_path: f.imageUrl,
          user_id: '',
          username: '',
        };
      })
    );
    return {
      exportedAt: new Date().toISOString(),
      totalItems: allItems.length,
      items: allItems,
    };
  }, [processedFiles]);

  // Step 1: Upload Page
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 space-y-6 max-w-2xl">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                票據憑證辨識系統
              </h1>
              <p className="text-muted-foreground">
                上傳憑證圖片或 PDF，AI 自動批次擷取會計資料
              </p>
            </div>
            
            <div className="flex flex-col gap-2 items-end">
              <div className="bg-muted p-2 rounded-lg border border-border scale-90 origin-right">
                <RadioGroup 
                  value={mode} 
                  onValueChange={(v) => setMode(v as any)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="user" id="user-mode" />
                    <Label htmlFor="user-mode" className="text-xs cursor-pointer">一般</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="dev" id="dev-mode" />
                    <Label htmlFor="dev-mode" className="text-xs cursor-pointer flex items-center gap-1 text-orange-600">
                      <Terminal className="h-3 w-3" /> 開發
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="bg-muted p-2 rounded-lg border border-border scale-90 origin-right">
                <RadioGroup 
                  value={selectedModel} 
                  onValueChange={setSelectedModel}
                  className="flex gap-3"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="gpt-4o" id="m-gpt-4o" />
                    <Label htmlFor="m-gpt-4o" className="text-xs cursor-pointer">4o</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="gpt-4o-mini" id="m-4o-mini" />
                    <Label htmlFor="m-4o-mini" className="text-xs cursor-pointer">Mini</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="o1" id="m-o1" />
                    <Label htmlFor="m-o1" className="text-xs cursor-pointer font-bold text-purple-600" title="支援圖片辨識">o1</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="o3-mini" id="m-o3" />
                    <Label htmlFor="m-o3" className="text-xs cursor-pointer text-indigo-600 opacity-50" title="注意：o3-mini 目前不支援圖片辨識">o3 (不支圖)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          {mode === "dev" ? (
            <Card className="p-6 shadow-lg border-2 border-orange-200 bg-orange-50/10 space-y-4">
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>本機資料夾路徑 (例如: D:\Invoices\Test)</Label>
                  <Input 
                    placeholder="請輸入完整路徑" 
                    value={devConfig.folderPath}
                    onChange={(e) => setDevConfig({...devConfig, folderPath: e.target.value})}
                  />
                </div>
                <div className="flex gap-4 items-end">
                  <div className="w-24 space-y-2">
                    <Label>辨識次數</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={devConfig.iterations}
                      onChange={(e) => setDevConfig({...devConfig, iterations: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <Button 
                    onClick={runDevProcess} 
                    disabled={isProcessing}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    執行壓力測試
                  </Button>
                </div>
              </div>
              
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-orange-600 font-medium">測試中...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-orange-100" />
                </div>
              )}
            </Card>
          ) : (
            <>
              <Card className="p-6 shadow-lg">
                <ReceiptUploader onFilesAdd={handleFilesAdd} />
              </Card>

              <Card className="p-6 shadow-lg">
                <UploadFileList
                  files={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                />
              </Card>

              {uploadedFiles.length > 0 && (
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleStartRecognition}
                    className="gap-2 px-8"
                  >
                    <Play className="w-5 h-5" />
                    開始辨識 ({uploadedFiles.length} 個檔案)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Result Page
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">
              辨識結果
            </h1>
            <p className="text-sm text-muted-foreground">
              {processedFiles.filter(f => f.status === 'success').length}/{processedFiles.length} 個檔案已辨識
            </p>
          </div>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            重新上傳
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-160px)]">
          {/* Left Panel */}
          <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden">
            {/* Top: File List */}
            <Card className="p-4 shadow-lg flex-shrink-0">
              <BatchFileList
                files={processedFiles}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  ⚠️ 編輯中，請先儲存或取消後再切換檔案
                </p>
              )}
            </Card>

            {/* Bottom: Recognition Results */}
            <Card className="p-4 shadow-lg flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  費用明細
                </h2>
                <span className="text-sm text-muted-foreground">
                  {activeFile?.lineItems.length || 0} 筆
                </span>
              </div>

              {activeFile?.status === 'processing' ? (
                <div className="flex items-center justify-center py-12 flex-1">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">AI 正在辨識中...</p>
                  </div>
                </div>
              ) : activeFile?.status === 'error' ? (
                <div className="text-center py-12 text-destructive flex-1">
                  {activeFile.error || '辨識失敗'}
                </div>
              ) : activeFile ? (
              <RecognitionItemList
                  items={activeFile.lineItems}
                  activeItemId={activeItemId}
                  highlightedItemIds={highlightedItemIds}
                  onItemClick={handleItemClick}
                  onItemUpdate={handleItemUpdate}
                  onItemDelete={handleItemDelete}
                  onItemConfirm={handleItemConfirm}
                  onItemAdd={handleItemAdd}
                  onEditingChange={setIsEditing}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground flex-1">
                  請選擇檔案
                </div>
              )}
            </Card>
          </div>

          {/* Right Panel: Receipt Preview */}
          <Card className="lg:col-span-7 p-4 shadow-lg flex flex-col">
            {activeFile ? (
              <>
                <div className="flex-1 overflow-hidden">
                  <ReceiptPreview
                    imageUrl={activeFile.imageUrl}
                    ocrBlocks={activeFile.ocrBlocks}
                    activeBlockIds={activeBlockIds}
                    onBlockClick={handleBlockClick}
                    onEmptyClick={handleEmptyClick}
                    totalAmount={totalAmount}
                  />
                </div>
                
                {/* Export Buttons */}
                <div className="pt-4 border-t mt-4 flex justify-end">
                  <ExportButtons exportData={exportData} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                請選擇檔案查看預覽
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
