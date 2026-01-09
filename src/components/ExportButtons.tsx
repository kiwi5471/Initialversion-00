import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportData } from "@/types/batch";

interface ExportButtonsProps {
  exportData: ExportData;
}

export function ExportButtons({ exportData }: ExportButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

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
        variant="outline"
        size="sm"
        onClick={handleDownload}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Download JSON
      </Button>
    </div>
  );
}
