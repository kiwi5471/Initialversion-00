import { useState } from "react";
import { FileUploader } from "@/components/FileUploader";
import { ExpenseTable } from "@/components/ExpenseTable";
import { Card } from "@/components/ui/card";
import { ExpenseEntry } from "@/types/invoice";
import { Loader2, FileCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFilesProcessed = (newEntries: ExpenseEntry[]) => {
    setEntries((prev) => [...prev, ...newEntries]);
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
          <FileUploader 
            onFilesProcessed={handleFilesProcessed} 
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
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
