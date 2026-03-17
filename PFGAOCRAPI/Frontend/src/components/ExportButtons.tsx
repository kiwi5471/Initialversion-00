import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportData } from "@/types/batch";
import { getApiBase, getURLUserInfo } from "@/lib/utils";

interface ExportButtonsProps {
  exportData: ExportData;
}

export function ExportButtons({ exportData }: ExportButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jsonString = JSON.stringify(exportData, null, 2);

  const handleCopy = async () => {
    try {
      // 構建與 handleSendToVB 相同的 VB 後端結構供複製
      const userInfo = getURLUserInfo();
      const vbFormattedData = {
        Company: "TFG",
        UserId: userInfo.userid || "ADMIN",
        Dept: "0000",
        Receipts: exportData.items.map(item => ({
          DOC_ID: item.name || "N/A",
          FILE_NAME: item.scanned_filename,
          FILE_PATH: item.file_path,
          VOUCHER_TYPE: item.category || "0",
          INVOICE_NO: item.name || "",
          INVOICE_DATE: item.date || "",
          SELLER_NAME: item.vendor || "",
          SELLER_TAX_ID: item.tax_id || "",
          BUYER_NAME: item.buyer_name || "",
          BUYER_TAX_ID: item.buyer_tax_id || "",
          AMT_BEFORE_TAX: parseFloat(item.amount_before_tax) || 0,
          TAX_AMT: parseFloat(item.tax_amount) || 0,
          AMT_TOTAL: parseFloat(item.amount_with_tax) || 0,
          TAX_TYPE: item.tax_type,
          MODIFY_NOTE: item.modify_note,
          IS_REUSED: item.is_reused,
          PAGE_NUM: item.page_number || 1,
          UPLOAD_USER: item.username,
          DEPT: "0000"
        }))
      };

      await navigator.clipboard.writeText(JSON.stringify(vbFormattedData, null, 2));
      setCopied(true);
      toast({
        title: "已複製",
        description: "VB 格式 JSON 已複製到剪貼簿",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "複製失敗",
        description: "請手動複製",
        variant: "destructive",
      });
    }
  };

  const handleSendToVB = async () => {
    setIsSubmitting(true);
    try {
      const apiBase = getApiBase();
      const userInfo = getURLUserInfo() as any;

      // 構建符合 VB 後端 OCRBatchRequest 的結構
      const requestBody = {
        Company: userInfo.company || "TFG",
        UserId: userInfo.userid || "ADMIN",
        Dept: userInfo.dept || "0000",
        Receipts: exportData.items.map(item => ({
          DOC_ID: item.name || "N/A",
          FILE_NAME: item.scanned_filename,
          FILE_PATH: item.file_path,
          VOUCHER_TYPE: item.category || "0",
          INVOICE_NO: item.name || "",
          INVOICE_DATE: item.date || "",
          SELLER_NAME: item.vendor || "",
          SELLER_TAX_ID: item.tax_id || "",
          BUYER_NAME: item.buyer_name || "",
          BUYER_TAX_ID: item.buyer_tax_id || "",
          AMT_BEFORE_TAX: parseFloat(item.amount_before_tax) || 0,
          TAX_AMT: parseFloat(item.tax_amount) || 0,
          AMT_TOTAL: parseFloat(item.amount_with_tax) || 0,
          TAX_TYPE: item.tax_type,
          MODIFY_NOTE: item.modify_note,
          IS_REUSED: item.is_reused,
          PAGE_NUM: item.page_number || 1,
          UPLOAD_USER: item.username,
          DEPT: userInfo.dept || "0000"
        }))
      };

      const response = await fetch(`${apiBase}/ocr/batch-process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response Status:", response.status);
      const responseText = await response.text();
      console.log("Raw Server Response:", responseText);

      if (!response.ok) {
        toast({
          title: "連線失敗",
          description: `伺服器回應 HTTP ${response.status}`,
          variant: "destructive"
        });
        throw new Error(`伺服器錯誤 (HTTP ${response.status}): ${responseText || "無內容回傳"}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        toast({
          title: "解析失敗",
          description: "伺服器回傳格式非 JSON",
          variant: "destructive"
        });
        throw new Error(`無法解析伺服器回傳的 JSON: ${responseText}`);
      }

      console.log("Parsed VB Submission Result:", result);

      if (result.Success === true) {
        toast({
          title: "送出成功",
          description: `已成功處理 ${result.SuccessCount} 筆資料`,
        });
      } else {
        // 增強錯誤訊息解析邏輯
        let finalMsg = result.Message || "處理失敗，但伺服器未提供具體原因。";

        // 讀取 Results 陣列中的詳細錯誤
        const detailList = result.Results || result.Details || [];
        if (detailList.length > 0) {
          const errors = detailList
            .filter((d: any) => d.ReturnCode !== "0")
            .map((d: any) => {
              const loc = d.IsComponentCreated ? "[COM元件]" : "[API]";
              const fileInfo = d.FileName ? `(${d.FileName})` : "";
              return `${d.DocId}${fileInfo}: ${d.Message}`;
            });

          if (errors.length > 0) {
            finalMsg = errors.join(" | ");
          }
        }

        // 如果還是沒訊息，回傳整個結果的 JSON 字串以便除錯
        if (!finalMsg) {
          finalMsg = `伺服器未回傳明確錯誤原因。完整回傳內容: ${JSON.stringify(result)}`;
        }

        toast({
          title: "送出失敗",
          description: finalMsg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Submit to VB failed:", error);
      // 捕捉網路連線或語法錯誤，顯示更具體的資訊
      const errorDetail = error.stack ? `${error.message} (詳情請見主控台)` : error.message;
      toast({
        title: "連線失敗",
        description: errorDetail || "無法連線至後端服務",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ocr-result-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "下載成功",
      description: "JSON 檔案已下載",
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="gap-2"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "已複製" : "Copy JSON"}
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={handleSendToVB}
        disabled={isSubmitting || exportData.items.length === 0}
        className="gap-2 bg-blue-600 hover:bg-blue-700"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {isSubmitting ? "傳送中..." : "送出資料至 VB"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        className="gap-2 text-muted-foreground"
      >
        <Download className="h-4 w-4" />
        備份 JSON
      </Button>
    </div>
  );
}
