import { useState, useCallback, useMemo, useRef } from "react";
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
import { RotateCcw, Play, Loader2, Terminal, Pause, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAppConfig, getOpenAIApiBase } from "@/lib/config";
import { OCR_SYSTEM_PROMPT } from "@/lib/ocrSystemPrompt";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { safeJsonParse, base64ToFile, getURLUserInfo, getApiBase } from "@/lib/utils";
import { convertPDFToImages } from "@/lib/pdfUtils";

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
  const [selectedModel, setSelectedModel] = useState("gpt-5.2");

  // Developer Mode States
  const resolveInvoiceCategory = (invoice: any): string => {
    const raw = invoice?.invoice_type ?? invoice?.category ?? "0";
    const normalized = String(raw).trim();
    return /^\d$/.test(normalized) ? normalized : "0";
  };
  const [mode, setMode] = useState<"user" | "dev">("user");
  const [devConfig, setDevConfig] = useState({
    folderPath: "",
    iterations: 1,
  });
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  const runDevProcess = async () => {
    if (!devConfig.folderPath) {
      toast({ title: "請輸入資料夾路徑", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setIsPaused(false);
    pauseRef.current = false;
    stopRef.current = false;

    try {
      const apiBase = getApiBase();
      const endpoint = import.meta.env.DEV ? `${apiBase}/scan-folder` : `${apiBase}/scan_folder.asp`;
      const scanRes = await fetch(endpoint, {
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

      // 檢查暫停與終止的輔助函數
      const checkStatus = async () => {
        if (stopRef.current) throw new Error("USER_TERMINATED");
        while (pauseRef.current) {
          if (stopRef.current) throw new Error("USER_TERMINATED");
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      };

      // 定義單一圖片處理邏輯
      const processSingleImage = async (base64ImageData: string, fileName: string, iteration: number, pageNum?: number) => {
        await checkStatus();
        const fileStartTime = Date.now();
        const displayFileName = pageNum ? `${fileName} (Page ${pageNum})` : fileName;

        try {
          if (selectedModel.includes("o3-mini")) {
            throw new Error("o3-mini 不支援圖片辨識，請切換至 gpt-4o 或 o1");
          }
          const isReasoningModel = selectedModel.startsWith("o1") || selectedModel.startsWith("o3") || selectedModel.startsWith("gpt-5");
          const systemRole = isReasoningModel ? "developer" : "system";

          const apiBaseUrl = getOpenAIApiBase();
          const resp = await fetch(`${apiBaseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                { role: systemRole, content: OCR_SYSTEM_PROMPT },
                {
                  role: "user", content: [
                    { type: "text", text: "請辨識這張圖片中的所有票據：" },
                    { type: "image_url", image_url: { url: base64ImageData } }
                  ]
                }
              ],
              ...(isReasoningModel ? {} : { response_format: { type: "json_object" } })
            })
          });

          const duration = (Date.now() - fileStartTime) / 1000;
          let statusText = resp.ok ? "Success" : `Error ${resp.status}`;
          let parsedResult: any = null;

          if (!resp.ok) {
            let detailText = "";
            const errText = await resp.text();
            try {
              const errBody = JSON.parse(errText);
              detailText = errBody.error?.message || errText;
            } catch {
              detailText = errText;
            }
            statusText = `Error ${resp.status}: ${detailText}`;
          } else {
            const result = await resp.json();
            const content = result.choices?.[0]?.message?.content;
            if (!content) {
              statusText = "Empty Result";
            } else {
              try {
                parsedResult = safeJsonParse(content);
              } catch (e) {
                parsedResult = { raw: content };
              }
            }
          }

          const inv = parsedResult?.invoices?.[0] ?? parsedResult ?? {};
          const logDetail = {
            檔案: displayFileName,
            耗時秒: duration,
            類別: inv.invoice_type ?? inv.category ?? "",
            廠商: inv.supplier_name ?? "",
            統編: inv.supplier_tax_id ?? "",
            日期: inv.invoice_date ?? "",
            發票號碼: inv.invoice_number ?? "",
            含稅金額: inv.total_amount ?? 0,
            稅額: inv.tax_amount ?? 0,
          };

          const logMsg = `[DevMode] ${displayFileName} | ${duration}s`;
          console.log(logMsg, logDetail);

          const apiBaseForLogs = getApiBase();
          const logEndpoint = import.meta.env.DEV ? `${apiBaseForLogs}/log` : `${apiBaseForLogs}/save_ocr.asp`;

          // 呼叫 C# API 儲存 OCR 結果 (DAO 模式)
          if (parsedResult) {
            const csharpApiUrl = "/ocr/process"; // 修改為 /ocr/ 路徑
            const receiptData = {
                DOC_ID: "", // 由後端生成
                SELLER_NAME: inv.supplier_name || "Unknown",
                INVOICE_DATE: inv.invoice_date || new Date().toISOString(),
                AMT_TOTAL: inv.total_amount || 0,
                TAX_AMT: inv.tax_amount || 0,
                INVOICE_NO: inv.invoice_number || "",
                // 根據 TFGAOCRV 模型對應
            };

            await fetch(csharpApiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(receiptData)
            }).catch(err => console.error("C# API Save Failed:", err));
          }

          await fetch(logEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: logMsg, detail: logDetail })
          }).catch(() => { });

        } catch (e: any) {
          const duration = (Date.now() - fileStartTime) / 1000;
          const logMsg = `[DevMode] ${displayFileName} | ${duration}s`;
          console.error(logMsg, e.message);

          const apiBaseForLogs = getApiBase();
          const logEndpoint = import.meta.env.DEV ? `${apiBaseForLogs}/log` : `${apiBaseForLogs}/save_ocr.asp`;

          await fetch(logEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: logMsg, detail: { 檔案: displayFileName, 耗時秒: duration } })
          }).catch(() => { });
        }
      };

      for (let i = 0; i < devConfig.iterations; i++) {
        for (let j = 0; j < files.length; j++) {
          await checkStatus();
          const fileData = files[j];

          if (fileData.isActualPdf) {
            try {
              console.log(`[DevMode] 正在處理 PDF: ${fileData.fileName}`);
              const pdfFile = await base64ToFile(fileData.base64Data, fileData.fileName, "application/pdf");
              const pages = await convertPDFToImages(pdfFile);

              for (const page of pages) {
                await processSingleImage(page.imageUrl, fileData.fileName, i + 1, page.pageNumber);
              }
            } catch (pdfErr: any) {
              const logMsg = `[DevMode] Iteration ${i + 1}, File: ${fileData.fileName} | Status: PDF Conversion Failed (${pdfErr.message}) | Took: 0s`;
              console.error(logMsg);
              const apiBase = getApiBase();
              const logEndpoint = import.meta.env.DEV ? `${apiBase}/log` : `${apiBase}/save_ocr.asp`;
              await fetch(logEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: logMsg })
              }).catch(() => { });
            }
          } else {
            await processSingleImage(fileData.base64Data, fileData.fileName, i + 1);
          }

          setProgress(Math.round(((i * files.length + (j + 1)) / (devConfig.iterations * files.length)) * 100));
        }
      }

      const totalDuration = (Date.now() - startTime) / 1000;
      toast({ title: "開發者模式執行完畢", description: `總計耗時 ${totalDuration}s` });

    } catch (error: any) {
      if (error.message === "USER_TERMINATED") {
        toast({ title: "已終止測試", description: "應使用者要求停止執行" });
      } else {
        toast({ title: "執行失敗", description: error.message, variant: "destructive" });
      }
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setIsPaused(false);
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

        const isReasoningModel = model.startsWith("o1") || model.startsWith("o3") || model.startsWith("gpt-5");
        const systemRole = isReasoningModel ? "developer" : "system";

        const apiBaseUrl = getOpenAIApiBase();
        const response = await fetch(`${apiBaseUrl}/v1/chat/completions`, {
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
                content: OCR_SYSTEM_PROMPT
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
                      url: `data:image/jpeg;base64,${base64Data}`,
                      detail: "high"
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
          const invoiceCategory = resolveInvoiceCategory(content);
          // 稅額保護邏輯：如果 AI 沒抓到稅額但有總額，嘗試計算 5%
          let finalTaxAmount = Number(content.tax_amount) || 0;
          const totalAmt = Number(content.total_amount) || 0;
          if (finalTaxAmount === 0 && totalAmt > 0) {
            finalTaxAmount = Math.round(totalAmt / 1.05 * 0.05);
            console.log(`[OCR] 自動補算稅額: ${finalTaxAmount} (基於總額 ${totalAmt})`);
          }

          const items = (content.items || []).map((item: any) => ({
            id: crypto.randomUUID(),
            category: invoiceCategory,
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
              category: invoiceCategory,
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
    try {
      if (uploadedFiles.length === 0) {
        toast({ title: "請先加入檔案", variant: "destructive" });
        return;
      }

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

        // 同步備份檔案到本地資料夾 (僅非 PDF 頁面才備份圖片，PDF 原始檔已在 Uploader 處理)
        if (!fileItem.pageNumber) {
          fileToBase64(fileItem.file).then(base64 => {
            const rawBase64 = base64.split(',')[1];
            const apiBase = getApiBase();
            const endpoint = import.meta.env.DEV ? `${apiBase}/save-file` : `${apiBase}/save_ocr.asp`;
            const userInfo = getURLUserInfo();

            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: fileItem.fileName,
                base64Data: rawBase64,
                ...userInfo,
                model: selectedModel
              })
            }).catch(err => console.error('備份檔案失敗:', err));
          });
        }

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
      const apiBase = getApiBase();
      const logEndpoint = import.meta.env.DEV ? `${apiBase}/log` : `${apiBase}/save_ocr.asp`;
      const userInfo = getURLUserInfo();

      fetch(logEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: logMsg,
          ...userInfo,
          model: selectedModel
        })
      }).catch(() => { });

      // 每張發票詳細 log
      const avgDuration = duration / uploadedFiles.length;
      for (const result of results) {
        if (result.status === 'success' && result.lineItems.length > 0) {
          for (const item of result.lineItems) {
            const logDetail = {
              檔案: result.fileName,
              耗時秒: Math.round(avgDuration * 100) / 100,
              類別: item.category || "0",
              廠商: item.vendor || "",
              統編: item.tax_id || "",
              日期: item.date || "",
              發票號碼: item.invoice_number || "",
              含稅金額: Number(item.amount_with_tax) || 0,
              稅額: Number(item.input_tax) || 0,
            };
            const detailMsg = `${result.fileName} | ${avgDuration.toFixed(2)}s`;
            fetch(logEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: detailMsg, detail: logDetail, ...userInfo, model: selectedModel })
            }).catch(() => { });
          }
        }
      }

      const successCount = results.filter(f => f.status === 'success').length;
      const totalItems = results.reduce((sum, f) => sum + f.lineItems.length, 0);

      toast({
        title: "批次辨識完成",
        description: `${successCount}/${results.length} 個檔案成功，共識別 ${totalItems} 筆項目`,
      });
    } catch (e: any) {
      console.error("[OCR] handleStartRecognition crashed:", e);
      toast({ title: "程式執行出錯", description: e.message || "請檢查瀏覽器主控台", variant: "destructive" });
      setStep('upload');
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFiles, selectedModel, toast, processFileWithRetry]);

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
          file_path: `uploaded_files/${f.fileName}`,
          user_id: getURLUserInfo().userid,
          username: getURLUserInfo().name,
          model: selectedModel,
        };
      })
    );
    return {
      exportedAt: new Date().toISOString(),
      totalItems: allItems.length,
      items: allItems,
    };
  }, [processedFiles, selectedModel]);

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
                    <RadioGroupItem value="gpt-5.2" id="m-gpt52" />
                    <Label htmlFor="m-gpt52" className="text-xs cursor-pointer font-bold text-red-700">GPT-5.2</Label>
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
                    onChange={(e) => setDevConfig({ ...devConfig, folderPath: e.target.value })}
                  />
                </div>
                <div className="flex gap-4 items-end">
                  <div className="w-24 space-y-2">
                    <Label>辨識次數</Label>
                    <Input
                      type="number"
                      min="1"
                      value={devConfig.iterations}
                      onChange={(e) => setDevConfig({ ...devConfig, iterations: parseInt(e.target.value) || 1 })}
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

                  {isProcessing && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          pauseRef.current = !pauseRef.current;
                          setIsPaused(pauseRef.current);
                        }}
                        className="border-orange-200 text-orange-600 hover:bg-orange-50"
                      >
                        {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                        {isPaused ? "恢復" : "暫停"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          stopRef.current = true;
                        }}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        終止
                      </Button>
                    </div>
                  )}
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
                <ReceiptUploader onFilesAdd={handleFilesAdd} model={selectedModel} />
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
