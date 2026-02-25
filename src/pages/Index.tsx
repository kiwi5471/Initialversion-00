import { useState, useRef } from "react";
import { FileUploader } from "@/components/FileUploader";
import { ExpenseTable } from "@/components/ExpenseTable";
import { Card } from "@/components/ui/card";
import { ExpenseEntry } from "@/types/invoice";
import { Loader2, FileCheck, Terminal, Play, Pause, Square } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAppConfig, getOpenAIApiBase } from "@/lib/config";
import { safeJsonParse, base64ToFile, getURLUserInfo, getApiBase } from "@/lib/utils";
import { convertPDFToImages } from "@/lib/pdfUtils";

const Index = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  
  // Developer Mode States
  const [mode, setMode] = useState<"user" | "dev">("user");
  const [devConfig, setDevConfig] = useState({
    folderPath: "",
    iterations: 1,
  });
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  const handleFilesProcessed = (newEntries: ExpenseEntry[]) => {
    setEntries((prev) => [...prev, ...newEntries]);
  };

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
      // 1. 從伺服器獲取檔案列表與內容
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

      console.log(`[DevMode] 開始執行 ${devConfig.iterations} 次循環，每循環 ${files.length} 個檔案`);
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

          const apiBase = getOpenAIApiBase();
          const resp = await fetch(`${apiBase}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                { role: systemRole, content: `你是一個專業的台灣稅務專家與 OCR 辨識助手，專精於精確擷取台灣各種發票（包括：電子發票、三聯式/二聯式收銀機發票、三聯式/二聯式手寫發票）的資訊。

### 最重要規則：多張發票辨識
- 圖片中可能同時存在**多張實體發票或收據**（例如：將數張發票放在一起掃描，或一頁有多個獨立欄位）。
- **每一張獨立的發票必須輸出為 invoices 陣列中的一個獨立物件**，不可將多張發票合併成一筆。
- 判斷是否為「獨立發票」的依據：不同的發票號碼、不同的供應商、不同的發票章、不同的交易日期等。

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
     - 優先讀取發票上明列的「營業稅」欄位。
     - 若發票未明列稅額、或為免稅/收據/零稅率，稅額一律填 0，**不可自行推算**。
5. **細項 (Line Items) 處理規則**：
   - **簡化彙整規則**：若一張發票有多個細項明細，**請將所有品項彙整為一筆代表性項目**即可。
   - **描述格式**：使用「[主要品項名稱] 等一式」或根據發票內容判斷類別。
   - **金額一致性**：該彙整項目的金額（amount）必須等於發票的總計含稅金額（total_amount）。
6. **發票類型 (category)**：請判斷發票類型，填入以下其中一項：電子發票、三聯式收銀機發票、二聯式收銀機發票、三聯式手寫發票、二聯式手寫發票、收據/其他。

### 思考過程 (Thought Process)：
在輸出 JSON 前，請先在 "thought_process" 中簡述：
- 圖片中共識別到幾張獨立發票？
- 各發票的類型與賣方資訊來源。

### 輸出規範：
請僅回傳 JSON 物件。**若圖片中有 N 張獨立發票，invoices 陣列必須有 N 個物件。**
{"invoices": [{"thought_process": "...", "category": "發票類型", "supplier_name":"...", "supplier_tax_id":"...", "invoice_number":"...", "invoice_date":"...", "total_amount":0, "tax_amount":0, "items": [{"description":"...", "amount":0}]}]}` },
                { role: "user", content: [
                  { type: "text", text: "請辨識這張圖片中的所有票據：" },
                  { type: "image_url", image_url: { url: base64ImageData } }
                ]}
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

          // 從結果提取指定欄位
          const inv = parsedResult?.invoices?.[0] ?? parsedResult ?? {};
          const logDetail = {
            檔案: displayFileName,
            耗時秒: duration,
            類別: inv.category ?? "",
            廠商: inv.supplier_name ?? "",
            統編: inv.supplier_tax_id ?? "",
            日期: inv.invoice_date ?? "",
            發票號碼: inv.invoice_number ?? "",
            含稅金額: inv.total_amount ?? 0,
            稅額: inv.tax_amount ?? 0,
          };

          const logMsg = `[DevMode] ${displayFileName} | ${duration}s`;
          console.log(logMsg, logDetail);

          const targetApiBase = getApiBase();
          const logEndpoint = import.meta.env.DEV ? `${targetApiBase}/log` : `${targetApiBase}/save_ocr.asp`;

          await fetch(logEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: logMsg, detail: logDetail })
          }).catch(() => {});

        } catch (e: any) {
          const duration = (Date.now() - fileStartTime) / 1000;
          const logMsg = `[DevMode] ${displayFileName} | ${duration}s`;
          console.error(logMsg, e.message);
          
          const targetLogApiBase = getApiBase();
          const logEndpoint = import.meta.env.DEV ? `${targetLogApiBase}/log` : `${targetLogApiBase}/save_ocr.asp`;

          await fetch(logEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: logMsg, detail: { 檔案: displayFileName, 耗時秒: duration } })
          }).catch(() => {});
        }
      };

      for (let i = 0; i < devConfig.iterations; i++) {
        console.log(`[DevMode] 第 ${i + 1} 次執行...`);
        
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
              const logMsg = `[DevMode] Iteration ${i+1}, File: ${fileData.fileName} | Status: PDF Conversion Failed (${pdfErr.message}) | Took: 0s`;
              console.error(logMsg);
              const logApiBase = getApiBase();
              const logEndpoint = import.meta.env.DEV ? `${logApiBase}/log` : `${logApiBase}/save_ocr.asp`;
              await fetch(logEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: logMsg })
              }).catch(() => {});
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              票據憑證辨識與出差精算系統
            </h1>
            <p className="text-muted-foreground">
              上傳票據憑證，自動辨識財務資訊，快速產生出差精算表
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <div className="bg-muted p-3 rounded-lg border border-border">
              <RadioGroup 
                value={mode} 
                onValueChange={(v) => setMode(v as any)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="user" id="user" />
                  <Label htmlFor="user" className="cursor-pointer">一般使用者</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dev" id="dev" />
                  <Label htmlFor="dev" className="cursor-pointer flex items-center gap-1 text-orange-600">
                    <Terminal className="h-4 w-4" /> 開發者模式
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-muted p-3 rounded-lg border border-border">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">選擇 AI 模型</div>
              <RadioGroup 
                value={selectedModel} 
                onValueChange={setSelectedModel}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gpt-4o" id="gpt-4o" />
                  <Label htmlFor="gpt-4o" className="cursor-pointer">GPT-4o</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gpt-4o-mini" id="gpt-4o-mini" />
                  <Label htmlFor="gpt-4o-mini" className="cursor-pointer">4o-Mini</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="o1" id="o1" />
                  <Label htmlFor="o1" className="cursor-pointer font-bold text-purple-600">o1 (支援圖片)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="o3-mini" id="o3-mini" />
                  <Label htmlFor="o3-mini" className="cursor-pointer text-indigo-600" title="注意：o3-mini 目前在 API 中不支援圖片辨識">o3-Mini (僅限文字)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gpt-5.1" id="gpt-5.1" />
                  <Label htmlFor="gpt-5.1" className="cursor-pointer font-bold text-red-600">GPT-5.1</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gpt-5.2" id="gpt-5.2" />
                  <Label htmlFor="gpt-5.2" className="cursor-pointer font-bold text-red-700">GPT-5.2</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        {mode === "dev" ? (
          <Card className="p-6 shadow-lg border-2 border-orange-200 bg-orange-50/10">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>本機資料夾路徑</Label>
                <Input 
                  placeholder="例如: D:\Invoices\Test" 
                  value={devConfig.folderPath}
                  onChange={(e) => setDevConfig({...devConfig, folderPath: e.target.value})}
                />
              </div>
              <div className="w-32 space-y-2">
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
                className="bg-orange-600 hover:bg-orange-700 text-white min-w-[120px]"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                執行測試
              </Button>

              {isProcessing && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      pauseRef.current = !pauseRef.current;
                      setIsPaused(pauseRef.current);
                    }}
                    className="border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                    {isPaused ? "恢復" : "暫停"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      stopRef.current = true;
                    }}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    終止
                  </Button>
                </div>
              )}
            </div>
            
            {isProcessing && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-600 font-medium">大量壓力測試進行中...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-orange-100" />
              </div>
            )}
            
            <p className="mt-4 text-xs text-muted-foreground">
              ⚠️ 注意：開發者模式會直接從您的硬碟讀取檔案並消耗 API 配額，請確保備份服務 (ocr-logger.js) 正運作中。
            </p>
          </Card>
        ) : (
          <Card className="p-6 shadow-lg">
            <FileUploader 
              onFilesProcessed={handleFilesProcessed} 
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              model={selectedModel}
            />
            
            {isProcessing && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>處理中...</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 shadow-lg">
          <ExpenseTable entries={entries} onEntriesChange={setEntries} />
        </Card>

        {entries.length > 0 && (
          <Card className="p-4 bg-success/10 border-success">
            <div className="flex items-center gap-2 text-success">
              <FileCheck className="h-5 w-5" />
              <p className="text-sm font-medium">
                已辨識 {entries.length} 筆資料，可進行編輯或匯出
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
