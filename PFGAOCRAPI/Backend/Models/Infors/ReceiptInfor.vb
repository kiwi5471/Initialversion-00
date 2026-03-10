Namespace Models.Infors
    Public Class ReceiptInfor
        Public Property DOC_ID As String ' 憑證編號
        Public Property FILE_NAME As String ' 原始檔名
        Public Property FILE_PATH As String ' 檔案路徑
        Public Property UPLOAD_DATE As String ' 上傳日期
        Public Property UPLOAD_USER As String ' 上傳人
        Public Property DEPT As String ' 部門
        Public Property VOUCHER_TYPE As String ' 憑證類型代碼 (VOUCHER_NAME 為名稱)
        Public Property INVOICE_NO As String ' 發票號碼
        Public Property INVOICE_DATE As String ' 發票日期
        Public Property SELLER_NAME As String ' 賣方名稱
        Public Property SELLER_TAX_ID As String ' 賣方統編
        Public Property BUYER_NAME As String ' 買方名稱
        Public Property BUYER_TAX_ID As String ' 買方統編
        Public Property ITEM_DESC As String ' 品名
        Public Property QTY As Decimal ' 數量
        Public Property UNIT_PRICE As Decimal ' 單價
        Public Property AMT As Decimal ' 總價
        Public Property REMARK As String ' 備註
        Public Property AMT_BEFORE_TAX As Decimal ' 未稅金額
        Public Property TAX_AMT As Decimal ' 稅額
        Public Property AMT_TOTAL As Decimal ' 含稅金額
        Public Property TAX_TYPE As String ' 應稅/零稅/免稅
        Public Property EXPENSE_TYPE As String ' 費用類型
        Public Property ACCOUNT_CODE As String ' 會計科目
    End Class

    Public Class OCRBatchRequest
        Public Property Company As String
        Public Property Manno As String
        Public Property Buno As String
        Public Property Dept As String
        Public Property Receipts As List(Of ReceiptInfor)
    End Class
End Namespace
