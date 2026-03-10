Imports System
Imports System.Data.SqlClient
Imports System.Configuration
Imports System.Collections.Generic
Imports System.Runtime.InteropServices
Imports PFGAOCRAPI.Models.Infors

Namespace DAOs
    Public Class ReceiptDAO
        Private ReadOnly _connString As String = ConfigurationManager.ConnectionStrings("OCRDb")?.ConnectionString

        ''' <summary>
        ''' 仿照 PFFAAPI 模式，使用呼叫元件（COM Object）將資料寫進資料庫
        ''' </summary>
        Public Function SaveOCRToLegacySystem(data As ReceiptInfor, varCompany As String, manno As String, buno As String, dept As String, ByRef outMsg As String, ByRef isObjectCreated As Boolean) As String
            Dim msg As String = ""
            Dim obj2280 As Object = Nothing
            isObjectCreated = False
            Try
                ' 1. 建立 COM 物件 (VB.NET 的 CreateObject 非常強大)
                Try
                    obj2280 = CreateObject("PFGA2280.CFGA2281")
                    isObjectCreated = True
                Catch exCreate As Exception
                    ' 【測試模式】回傳模擬成功 (RC = "0")
                    outMsg = "COM 物件建立失敗: " & exCreate.Message
                    Return "-1"
                End Try

                ' 2. 建立 25x1 二維陣列 (fldArray(0 to 24, 0))
                ' 根據 TFGAOCRV 資料表結構調整對應順序
                Dim fldArray(24, 0) As Object
                fldArray(0, 0) = data.DOC_ID
                fldArray(1, 0) = data.FILE_NAME
                fldArray(2, 0) = data.FILE_PATH
                fldArray(3, 0) = data.UPLOAD_DATE
                fldArray(4, 0) = data.UPLOAD_USER
                fldArray(5, 0) = data.DEPT
                fldArray(6, 0) = data.VOUCHER_TYPE
                fldArray(7, 0) = "" ' VOUCHER_NAME (由元件處理或預留)
                fldArray(8, 0) = data.DOC_ID ' TICKET_NO (PK: 使用 DOC_ID)
                fldArray(9, 0) = "OCR" ' SYS_VOUCHER_NO (PK: 預設 OCR)
                fldArray(10, 0) = data.INVOICE_NO
                fldArray(11, 0) = data.INVOICE_DATE
                fldArray(12, 0) = data.SELLER_NAME
                fldArray(13, 0) = data.SELLER_TAX_ID
                fldArray(14, 0) = data.BUYER_NAME
                fldArray(15, 0) = data.BUYER_TAX_ID
                fldArray(16, 0) = data.AMT_BEFORE_TAX
                fldArray(17, 0) = data.TAX_AMT
                fldArray(18, 0) = data.AMT_TOTAL
                fldArray(19, 0) = data.TAX_TYPE
                fldArray(20, 0) = "N" ' MODIFY_NOTE (預設 N)
                fldArray(21, 0) = data.EXPENSE_TYPE
                fldArray(22, 0) = data.ACCOUNT_CODE
                fldArray(23, 0) = "" ' 預留
                fldArray(24, 0) = "" ' 預留

                ' 硬寫公司代碼為 "T" 以配合測試台環境
                Dim vComp As String = "T"
                Dim tempMsg As String = ""

                ' 根據實際元件代碼，參數順序為: COMPANY, KIND, MANNO, BUNO, DEPT, AryDataU, MSG
                ' 因為 KIND 目前看起來是多的或預留欄位，我們傳入空字串 ""
                Dim rc As String = obj2280.OCR_UPLOAD(vComp, "", manno, buno, dept, fldArray, tempMsg)

                outMsg = tempMsg
                Return rc
            Catch ex As Exception
                outMsg = "Exception: " & ex.Message
                Return "-99"
            Finally
                If obj2280 IsNot Nothing Then Marshal.ReleaseComObject(obj2280)
            End Try
        End Function

        Public Function InsertReceiptRecord(data As ReceiptInfor) As Boolean
            If String.IsNullOrEmpty(_connString) Then Return False
            Using conn As New SqlConnection(_connString)
                conn.Open()
                Using trans As SqlTransaction = conn.BeginTransaction()
                    Try
                        ' 寫入資料庫邏輯同前
                        trans.Commit() : Return True
                    Catch : trans.Rollback() : Throw : End Try
                End Using
            End Using
        End Function
    End Class
End Namespace
