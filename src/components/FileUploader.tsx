import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ExpenseEntry } from "@/types/invoice";

interface FileUploaderProps {
  onFilesProcessed: (entries: ExpenseEntry[]) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

// Sample data generator - returns demo entries based on uploaded files
const generateSampleEntries = (files: File[]): ExpenseEntry[] => {
  const sampleData = [
    {
      supplier_tax_id: "16446274",
      supplier_name: "台灣高鐵股份有限公司",
      item_description: "高鐵票 台北-台中",
      amount: 1440,
      debit_account: "旅費",
      debit_item: "國內交通",
      notes: "出差交通費",
    },
    {
      supplier_tax_id: "70813124",
      supplier_name: "台灣大車隊股份有限公司",
      item_description: "計程車資",
      amount: 350,
      debit_account: "交通費",
      debit_item: "市內交通",
      notes: "往返車站",
    },
    {
      supplier_tax_id: "23456789",
      supplier_name: "晶華國際酒店股份有限公司",
      item_description: "住宿費用",
      amount: 4500,
      debit_account: "住宿費",
      debit_item: "國內住宿",
      notes: "出差住宿",
    },
    {
      supplier_tax_id: "12345678",
      supplier_name: "王品餐飲股份有限公司",
      item_description: "餐飲費用",
      amount: 680,
      debit_account: "餐飲費",
      debit_item: "商務餐費",
      notes: "客戶餐敘",
    },
  ];

  return files.map((file, index) => {
    const sample = sampleData[index % sampleData.length];
    const today = new Date().toISOString().split('T')[0];
    
    return {
      id: crypto.randomUUID(),
      filename: file.name,
      supplier_tax_id: sample.supplier_tax_id,
      supplier_name: sample.supplier_name,
      invoice_date: today,
      item_description: sample.item_description,
      amount_exclusive_tax: Math.round(sample.amount / 1.05),
      tax_amount: Math.round(sample.amount - sample.amount / 1.05),
      amount_inclusive_tax: sample.amount,
      page_number: 1,
      output_type: "員工",
      payment_method: "電匯",
      expense_date: today,
      content: sample.item_description,
      quantity: 1,
      unit_price: sample.amount,
      currency: "TWD",
      amount: sample.amount,
      notes: sample.notes,
      debit_account: sample.debit_account,
      debit_item: sample.debit_item,
      debit_summary: sample.item_description,
      credit_account: "應付帳款",
      credit_item: "一般供應商",
      credit_summary: "差旅費",
    };
  });
};

export const FileUploader = ({ onFilesProcessed, isProcessing, setIsProcessing }: FileUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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

  const validateFiles = (files: FileList | File[]) => {
    const validFiles: File[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (!file.type.match(/^image\/(png|jpg|jpeg|gif|webp)|application\/pdf$/)) {
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

      validFiles.push(file);
    }

    return validFiles;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = validateFiles(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, [toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      const files = validateFiles(e.target.files);
      if (files.length > 0) {
        setSelectedFiles((prev) => [...prev, ...files]);
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "請選擇檔案",
        description: "請先選擇要上傳的票據檔案",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    // Simulate processing delay
    setTimeout(() => {
      const entries = generateSampleEntries(selectedFiles);
      onFilesProcessed(entries);
      setSelectedFiles([]);
      setIsProcessing(false);
      
      toast({
        title: "辨識完成",
        description: `已成功處理 ${entries.length} 筆票據資料（範例資料）`,
      });
    }, 1000);
  };

  return (
    <div className="space-y-4">
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
          <label htmlFor="file-upload">
            <Button type="button" variant="outline" className="cursor-pointer" asChild>
              <span>選擇檔案</span>
            </Button>
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

      {selectedFiles.length > 0 && (
        <Card className="p-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">已選擇的檔案 ({selectedFiles.length})</h4>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border bg-muted/50 p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[300px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              onClick={handleUpload}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? "處理中..." : `開始辨識 (${selectedFiles.length} 個檔案)`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
