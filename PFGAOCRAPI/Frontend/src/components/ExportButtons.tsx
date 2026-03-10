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
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast({
        title: "已複製",
        description: "JSON 已複製到剪貼簿",
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
      const userInfo = getURLUserInfo();
      
      // 構建符合 VB 後端 OCRBatchRequest 的結構
      const requestBody = {
        Company: userInfo.company || "TFG",
        Manno: userInfo.userid || "ADMIN",
        Buno: userInfo.buno || "001",
        Dept: userInfo.dept || "0000",
        Receipts: exportData.items.map(item => ({
          DOC_ID: item.name || "N/A",
          FILE_NAME: item.scanned_filename,
          FILE_PATH: item.file_path,
          INVOICE_NO: item.name || "",
          INVOICE_DATE: item.date || "",
          SELLER_NAME: item.vendor || "",
          SELLER_TAX_ID: item.tax_id || "",
          AMT_TOTAL: parseFloat(item.amount_with_tax) || 0,
          TAX_AMT: parseFloat(item.tax_amount) || 0,
          AMT_BEFORE_TAX: parseFloat(item.amount_without_tax) || 0,
          UPLOAD_USER: item.username,
          DEPT: userInfo.dept || "0000",
          VOUCHER_TYPE: item.category || "0"
        }))
      };

      const response = await fetch(`${apiBase}/ocr/batch-process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.Success) {
        toast({
          title: "送出成功",
          description: `已成功處理 ${result.ProcessedCount} 筆資料`,
        });
      } else {
        const errorDetails = result.Details?.filter((d: any) => d.ReturnCode !== "0")
          .map((d: any) => `${d.DocId}: ${d.Message}`)
          .join(", ") || "未知錯誤";

        toast({
          title: "部分或全部送出失敗",
          description: `錯誤資訊: ${errorDetails}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Submit to VB failed:", error);
      toast({
        title: "連線失敗",
        description: error.message || "無法連線至後端服務",
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
