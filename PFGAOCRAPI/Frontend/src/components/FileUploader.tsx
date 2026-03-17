import { useCallback, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn, safeJsonParse, getURLUserInfo, getApiBase } from "@/lib/utils";
import { getAppConfig, getOpenAIApiBase } from "@/lib/config";
import { OCR_SYSTEM_PROMPT } from "@/lib/ocrSystemPrompt";
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
  isPdfPage?: boolean;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const recognizeWithGPT = async (file: File, selectedModel?: string): Promise<{ entries: ExpenseEntry[], usage: any, invoiceList: any[] }> => {
  const config = await getAppConfig();
  const apiKey = config.apiKey;
  const model = selectedModel || config.model;

  if (!apiKey) {
    throw new Error("找不到 API Key，請檢查 public/api_config.json 或環境變數");
  }

  const base64Image = await fileToBase64(file);
  const base64Data = base64Image.split(',')[1];

  console.log(`[OCR] Sending ${file.name} to ${model}...`);

  // o 系列與新型 gpt-5 模型處理
  const isReasoningModel = model.startsWith("o1") || model.startsWith("o3") || model.startsWith("gpt-5");
  const systemRole = isReasoningModel ? "developer" : "system";

  // o3-mini 不支援 Vision
  if (model.includes("o3-mini")) {
    throw new Error("o3-mini 模型目前不支援圖片辨識 (Vision)，請改用 gpt-4o 或 o1。");
  }

  const apiBase = getOpenAIApiBase();
  const response = await fetch(`${apiBase}/v1/chat/completions`, {
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
              text: "請辨識這張圖片中的所有票據："
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
    const finalTaxAmount = Number(inv.tax_amount) || 0;
    const totalAmt = Number(inv.total_amount) || 0;

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
        model: model,
        category: inv.invoice_type || "0",
        invoice_type: invoiceTypeLabel(inv.invoice_type || "0"),
      });
    }
  }

  return { entries: processedEntries, usage: result.usage, invoiceList };
};

// 將 invoice_type 代碼對映為文字
const invoiceTypeLabel = (code: string): string => {
  const map: Record<string, string> = {
    "00": "電子發票",
    "01": "三聯式手開發票",
    "02": "三聯式收銀機發票",
    "03": "二聯式收銀機發票",
    "04": "進貨折讓證明單",
    "05": "海關進出口貨物稅費繳納證",
    "06": "三聯式零稅率發票",
    "07": "進貨零稅率折讓證明單",
    "08": "海關進口代徵退還溢繳營業稅",
    "09": "境外電商不得扣抵電子發票",
    "10": "交通票(高鐵)",
    "11": "交通票(機票)",
    "12": "交通票(客運)",
    "13": "交通票(台鐵)",
  };
  return map[code] || code;
};

const FileUploader = ({ onFilesProcessed, isProcessing, setIsProcessing, model: modelProps }: FileUploaderProps) => {
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

        // 立即將原始 PDF 備份到伺服器
        fileToBase64(file).then(base64 => {
          const rawBase64 = base64.split(',')[1];
          const apiBase = getApiBase();
          const endpoint = `${apiBase}/ocr/save-temp`;
          const userInfo = getURLUserInfo();

          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              base64Data: rawBase64,
              ...userInfo,
              model: model
            })
          }).catch(err => console.error('PDF 備份失敗:', err));
        });

        try {
          const pages = await convertPDFToImages(file);
          pages.forEach(page => {
            validFiles.push({
              file: page.file,
              preview: page.imageUrl,
              // 加入標記避免重複備份 JPG 頁面
              isPdfPage: true
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
    const model = modelProps || config.model;

    try {
      const allEntries: ExpenseEntry[] = [];
      let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      for (const item of selectedFiles) {
        const fileStartTime = Date.now();
        let serverFilePath = "";

        // 將檔案透過後端 API 儲存至 uploaded_files (暫存區)
        try {
          const base64 = await fileToBase64(item.file);
          const rawBase64 = base64.split(',')[1];
          const apiBase = getApiBase();
          const endpoint = `${apiBase}/ocr/save-temp`;

          const saveRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.file.name,
              base64Data: rawBase64
            })
          });

          if (saveRes.ok) {
            const saveResult = await saveRes.json();
            serverFilePath = saveResult.FilePath;
            console.log(`[Upload] File saved to server: ${serverFilePath}`);
          } else {
            console.error(`[Upload] Save failed with HTTP ${saveRes.status}`);
          }
        } catch (err) {
          console.error('儲存暫存檔失敗:', err);
        }

        const { entries, usage, invoiceList: fileInvoices } = await recognizeWithGPT(item.file, model);

        // 將伺服器路徑注入到每個辨識出的 entry 中
        entries.forEach(entry => {
          entry.file_path = serverFilePath;
        });

        const fileDuration = (Date.now() - fileStartTime) / 1000;
        allEntries.push(...entries);

        // 每張發票送出詳細 log
        const logApiBase = getApiBase();
        const logEndpointPerFile = import.meta.env.DEV ? `${logApiBase}/log` : `${logApiBase}/save_ocr.asp`;
        const userInfoForLog = getURLUserInfo();
        for (const inv of fileInvoices) {
          const logDetail = {
            檔案: item.file.name,
            耗時秒: fileDuration,
            類別: invoiceTypeLabel(inv.invoice_type ?? "0"),
            廠商: inv.supplier_name || "",
            統編: inv.supplier_tax_id || "",
            日期: inv.invoice_date || "",
            發票號碼: inv.invoice_number || "",
            含稅金額: Number(inv.total_amount) || 0,
            稅額: Number(inv.tax_amount) || 0,
          };
          const logMsg = `${item.file.name} | ${fileDuration}s`;
          fetch(logEndpointPerFile, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: logMsg, detail: logDetail, ...userInfoForLog, model })
          }).catch(() => { });
        }

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
      const apiBase = getApiBase();
      const logEndpoint = import.meta.env.DEV ? `${apiBase}/log` : `${apiBase}/save_ocr.asp`;
      const userInfo = getURLUserInfo(); // 也要抓取使用者資訊

      fetch(logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: logMsg,
          ...userInfo,
          model: model
        })
      }).catch(err => console.error('無法傳送日誌:', err));

      // 組建 ExportData（與 Copy JSON 按鈕相同格式）並寫入 log
      const exportItems = allEntries.map(entry => ({
        name: entry.notes?.match(/發票號碼: (.+)/)?.[1] || null,
        category: entry.invoice_type || "",
        tax_id: entry.supplier_tax_id || null,
        vendor: entry.supplier_name || "",
        date: entry.invoice_date || null,
        amount_without_tax: String(entry.amount_exclusive_tax || 0),
        tax_amount: String(entry.tax_amount || 0),
        amount_with_tax: String(entry.amount_inclusive_tax || 0),
        scanned_filename: entry.filename || "",
        file_path: entry.file_path || "",
        user_id: userInfo.userId || "",
        username: userInfo.username || "",
        model: model || config.model,
      }));
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalItems: exportItems.length,
        items: exportItems,
      };
      fetch(logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "[ExportData] Copy JSON",
          exportData,
          ...userInfo,
          model: model
        })
      }).catch(err => console.error('無法傳送 ExportData 日誌:', err));

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
                name="file-upload"
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

export { FileUploader };
