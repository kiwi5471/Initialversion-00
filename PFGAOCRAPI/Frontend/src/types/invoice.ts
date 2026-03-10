export interface InvoiceData {
  id: string;
  filename: string;
  supplier_tax_id: string;
  supplier_name: string;
  invoice_date: string;
  item_description: string;
  amount_exclusive_tax: number;
  tax_amount: number;
  amount_inclusive_tax: number;
  page_number: number;
  model?: string;
}

export interface ExpenseEntry extends InvoiceData {
  output_type: '員工' | '廠商';
  payment_method: '電匯' | '外幣' | '票據' | '業者';
  expense_date: string;
  content: string;
  quantity: number;
  unit_price: number;
  currency: string;
  amount: number;
  notes: string;
  debit_account: string;
  debit_item: string;
  debit_summary: string;
  credit_account: string;
  credit_item: string;
  credit_summary: string;
}

export interface OCRResponse {
  success: boolean;
  data?: {
    filename: string;
    supplier_tax_id: string;
    supplier_name: string;
    invoice_date: string;
    item_description: string;
    amount_exclusive_tax: number;
    tax_amount: number;
    amount_inclusive_tax: number;
  };
  error?: string;
}
