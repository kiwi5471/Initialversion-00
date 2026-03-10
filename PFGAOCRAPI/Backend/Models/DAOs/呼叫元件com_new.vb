Option Explicit

Public Function getConnection(ByVal COMPANY As String) As ADODB.Connection
    Dim CONN As ADODB.Connection
    On Error GoTo HandleError
    Set CONN = New ADODB.Connection
    Select Case COMPANY
       Case "T"
          CONN.Open "File Name=C:\DATALINK\DMBASGAMS.UDL"
       Case "N"
          CONN.Open "File Name=C:\DATALINK\DMGAMSNPST.UDL"
       Case "P"
          CONN.Open "File Name=C:\DATALINK\DMGAMSPCT.UDL"
       Case "B"
          CONN.Open "File Name=C:\DATALINK\DMGAMSPSTW.UDL"
       Case Else
          GoTo HandleError
    End Select
    Set getConnection = CONN
    Exit Function
HandleError:
    Set getConnection = Nothing
    Err.Raise Err.Number, Err.Source & "  *系統當機請通知資訊中心! ", "**" & Err.Description & "存取資料庫連線錯誤。"
End Function

Public Function OCR_UPLOAD(ByVal COMPANY As String, ByVal KIND As String, ByVal MANNO As String, ByVal BUNO As String, ByVal DEPT As String, ByRef AryDataU As Variant, ByRef MSG As String) As String
'----------------------------------------------------------------------------------------
'目的   : OCR資料寫入 TFGAOCRV (對應新 Table 結構)
'傳回值 : 0:正常 ; 其他:錯誤訊息
'----------------------------------------------------------------------------------------
On Error GoTo Err_Handle

    Dim CONN As ADODB.Connection
    Dim RS As New ADODB.Recordset
    Dim ObjContext As ObjectContext
    Dim SQL As String, RC As String
    Dim strInterruptPoint As String
    
    Dim DOC_ID As String
    Dim FILE_NAME As String
    Dim FILE_PATH As String
    Dim UPLOAD_DATE As String
    Dim UPLOAD_USER As String
    ' DEPT 已經在參數中，但 AryDataU(5,0) 也是 DEPT，COM 會以 AryDataU 為準
    Dim VOUCHER_TYPE As String
    Dim VOUCHER_NAME As String
    Dim TICKET_NO As String
    Dim SYS_VOUCHER_NO As String
    Dim INVOICE_NO As String
    Dim INVOICE_DATE As String
    Dim SELLER_NAME As String
    Dim SELLER_TAX_ID As String
    Dim BUYER_NAME As String
    Dim BUYER_TAX_ID As String
    Dim AMT_BEFORE_TAX As String
    Dim TAX_AMT As String
    Dim AMT_TOTAL As String
    Dim TAX_TYPE As String
    Dim MODIFY_NOTE As String
    Dim EXPENSE_TYPE As String
    Dim ACCOUNT_CODE As String
    
    Set ObjContext = GetObjectContext()
    
    strInterruptPoint = "Step.1"
    RC = "0"
    
    Set CONN = CreateObject("ADODB.Connection")
    CONN.CursorLocation = adUseClient
    Set CONN = getConnection(COMPANY)
    
    ' 從 AryDataU 讀取資料 (需與 ReceiptDAO.vb 的 fldArray 索引完全對應)
    DOC_ID = Trim(AryDataU(0, 0) & "")
    FILE_NAME = Trim(AryDataU(1, 0) & "")
    FILE_PATH = Trim(AryDataU(2, 0) & "")
    UPLOAD_DATE = Trim(AryDataU(3, 0) & "")
    UPLOAD_USER = Trim(AryDataU(4, 0) & "")
    DEPT = Trim(AryDataU(5, 0) & "")
    VOUCHER_TYPE = Trim(AryDataU(6, 0) & "")
    VOUCHER_NAME = Trim(AryDataU(7, 0) & "")
    TICKET_NO = Trim(AryDataU(8, 0) & "")
    SYS_VOUCHER_NO = Trim(AryDataU(9, 0) & "")
    INVOICE_NO = Trim(AryDataU(10, 0) & "")
    INVOICE_DATE = Trim(AryDataU(11, 0) & "")
    SELLER_NAME = Trim(AryDataU(12, 0) & "")
    SELLER_TAX_ID = Trim(AryDataU(13, 0) & "")
    BUYER_NAME = Trim(AryDataU(14, 0) & "")
    BUYER_TAX_ID = Trim(AryDataU(15, 0) & "")
    AMT_BEFORE_TAX = Trim(AryDataU(16, 0) & "")
    TAX_AMT = Trim(AryDataU(17, 0) & "")
    AMT_TOTAL = Trim(AryDataU(18, 0) & "")
    TAX_TYPE = Trim(AryDataU(19, 0) & "")
    MODIFY_NOTE = Trim(AryDataU(20, 0) & "")
    EXPENSE_TYPE = Trim(AryDataU(21, 0) & "")
    ACCOUNT_CODE = Trim(AryDataU(22, 0) & "")
    
    If INVOICE_NO = "" Then
        RC = "INVOICE_NO不可空白!"
        GoTo Err_Handle
    End If
    
    strInterruptPoint = "Step.2"
    
    ' 構建符合新資料表 TFGAOCRV 的 SQL
    SQL = "INSERT INTO TFGAOCRV ("
    SQL = SQL & "DOC_ID, FILE_NAME, FILE_PATH, UPLOAD_DATE, UPLOAD_USER, DEPT, "
    SQL = SQL & "VOUCHER_TYPE, VOUCHER_NAME, TICKET_NO, SYS_VOUCHER_NO, INVOICE_NO, INVOICE_DATE, "
    SQL = SQL & "SELLER_NAME, SELLER_TAX_ID, BUYER_NAME, BUYER_TAX_ID, "
    SQL = SQL & "AMT_BEFORE_TAX, TAX_AMT, AMT_TOTAL, TAX_TYPE, MODIFY_NOTE, EXPENSE_TYPE, ACCOUNT_CODE"
    SQL = SQL & ") VALUES ("
    SQL = SQL & "'" & Replace(DOC_ID, "'", "''") & "',"
    SQL = SQL & "N'" & Replace(FILE_NAME, "'", "''") & "',"
    SQL = SQL & "N'" & Replace(FILE_PATH, "'", "''") & "',"
    SQL = SQL & IIf(UPLOAD_DATE = "", "NULL", "'" & Replace(UPLOAD_DATE, "'", "''") & "'") & ","
    SQL = SQL & "'" & Replace(UPLOAD_USER, "'", "''") & "',"
    SQL = SQL & "'" & Replace(DEPT, "'", "''") & "',"
    SQL = SQL & "'" & Replace(VOUCHER_TYPE, "'", "''") & "',"
    SQL = SQL & "N'" & Replace(VOUCHER_NAME, "'", "''") & "',"
    SQL = SQL & "'" & Replace(TICKET_NO, "'", "''") & "',"
    SQL = SQL & "'" & Replace(SYS_VOUCHER_NO, "'", "''") & "',"
    SQL = SQL & "'" & Replace(INVOICE_NO, "'", "''") & "',"
    SQL = SQL & IIf(INVOICE_DATE = "", "NULL", "'" & Replace(INVOICE_DATE, "'", "''") & "'") & ","
    SQL = SQL & "N'" & Replace(SELLER_NAME, "'", "''") & "',"
    SQL = SQL & "'" & Replace(SELLER_TAX_ID, "'", "''") & "',"
    SQL = SQL & "N'" & Replace(BUYER_NAME, "'", "''") & "',"
    SQL = SQL & "'" & Replace(BUYER_TAX_ID, "'", "''") & "',"
    SQL = SQL & IIf(AMT_BEFORE_TAX = "", "NULL", AMT_BEFORE_TAX) & ","
    SQL = SQL & IIf(TAX_AMT = "", "NULL", TAX_AMT) & ","
    SQL = SQL & IIf(AMT_TOTAL = "", "NULL", AMT_TOTAL) & ","
    SQL = SQL & "'" & Replace(TAX_TYPE, "'", "''") & "',"
    SQL = SQL & "'" & Replace(MODIFY_NOTE, "'", "''") & "',"
    SQL = SQL & "'" & Replace(EXPENSE_TYPE, "'", "''") & "',"
    SQL = SQL & "'" & Replace(ACCOUNT_CODE, "'", "''") & "'"
    SQL = SQL & ")"
    
    CONN.Execute SQL
    
    MSG = "Success"
    RC = "0"
    
MSG_Handle:
    If RC = "0" Then
        If Not ObjContext Is Nothing Then ObjContext.SetComplete
        GoTo End_Handle
    End If

Err_Handle:
    If Not ObjContext Is Nothing Then ObjContext.SetAbort
    
    If Err.Number <> 0 Then
        MSG = "[" & strInterruptPoint & "]" & Err.Description
        ' 在生產環境建議將 SQL 記錄到日誌而非直接彈給使用者，但為了調試方便暫時保留
        ' Err.Raise Err.Number, "錯誤發生,請通知資訊中心! ", MSG & vbCrLf & SQL
        On Error GoTo 0
    Else
        MSG = RC
    End If

End_Handle:
    OCR_UPLOAD = RC
    Set RS = Nothing
    Set CONN = Nothing
End Function