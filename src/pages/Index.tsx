import { useState } from "react";
import { FileUploader } from "@/components/FileUploader";
import { ExpenseTable } from "@/components/ExpenseTable";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ExpenseEntry } from "@/types/invoice";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const { toast } = useToast();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);
    const newEntries: ExpenseEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file.name);
      setProgress(((i + 1) / files.length) * 100);

      try {
        const imageData = await fileToBase64(file);

        const { data, error } = await supabase.functions.invoke('ocr-extract', {
          body: { imageData, filename: file.name }
        });

        if (error) throw error;

        if (data.success && data.data) {
          const extractedData = data.data;
          const entry: ExpenseEntry = {
            id: crypto.randomUUID(),
            filename: extractedData.filename || file.name,
            supplier_tax_id: extractedData.supplier_tax_id || "N/A",
            supplier_name: extractedData.supplier_name || "N/A",
            invoice_date: extractedData.invoice_date || new Date().toISOString().split('T')[0],
            item_description: extractedData.item_description || "",
            amount_exclusive_tax: extractedData.amount_exclusive_tax || 0,
            tax_amount: extractedData.tax_amount || 0,
            amount_inclusive_tax: extractedData.amount_inclusive_tax || 0,
            page_number: 1,
            output_type: "員工",
            payment_method: "電匯",
            expense_date: new Date().toISOString().split('T')[0],
            content: extractedData.item_description || "",
            quantity: 1,
            unit_price: extractedData.amount_inclusive_tax || 0,
            currency: "TWD",
            amount: extractedData.amount_inclusive_tax || 0,
            notes: "",
            debit_account: "旅費",
            debit_item: "",
            debit_summary: "",
            credit_account: "應付帳款",
            credit_item: "",
            credit_summary: "",
          };
          newEntries.push(entry);

          toast({
            title: "辨識成功",
            description: `已成功辨識 ${file.name}`,
          });
        } else {
          throw new Error(data.error || "辨識失敗");
        }
      } catch (error: any) {
        console.error(`Error processing ${file.name}:`, error);
        toast({
          title: "辨識失敗",
          description: `${file.name}: ${error.message || "未知錯誤"}`,
          variant: "destructive",
        });
      }
    }

    setEntries((prev) => [...prev, ...newEntries]);
    setIsProcessing(false);
    setProgress(0);
    setCurrentFile("");

    if (newEntries.length > 0) {
      toast({
        title: "批次處理完成",
        description: `成功辨識 ${newEntries.length} 個檔案`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            票據憑證辨識與出差精算系統
          </h1>
          <p className="text-muted-foreground">
            上傳票據憑證，自動辨識財務資訊，快速產生出差精算表
          </p>
        </div>

        <Card className="p-6 shadow-lg">
          <FileUploader onFilesSelected={processFiles} isProcessing={isProcessing} />
          
          {isProcessing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>處理中：{currentFile}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </Card>

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
