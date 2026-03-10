Imports System.Data.SqlClient
Imports System.Web.Http
Imports PFGAOCRAPI.Models.Infors

Namespace Controllers
    <RoutePrefix("ocr")>
    Public Class OCRController
        Inherits ApiController

        <HttpGet>
        <Route("ping")>
        Public Function Ping() As IHttpActionResult
            Return Ok("OCR API OK")
        End Function

        Private ReadOnly dao As New DAOs.ReceiptDAO()

        <HttpPost>
        <Route("batch-process")>
        Public Function BatchProcessOCR(<FromBody> request As OCRBatchRequest) As IHttpActionResult
            If request Is Nothing OrElse request.Receipts Is Nothing Then
                Return BadRequest("Invalid request data.")
            End If

            Try
                Dim results As New List(Of Object)()
                Dim successCount As Integer = 0

                For Each receipt As ReceiptInfor In request.Receipts
                    Dim msg As String = ""
                    Dim isObjectCreated As Boolean = False
                    
                    ' 1. 呼叫 VB 元件進行處理與寫入
                    Dim rc As String = dao.SaveOCRToLegacySystem(receipt, request.Company, request.Manno, request.Buno, request.Dept, msg, isObjectCreated)
                    
                    If rc = "0" Then
                        successCount += 1
                    End If

                    results.Add(New With {
                        .DocId = receipt.DOC_ID,
                        .ReturnCode = rc,
                        .Message = msg,
                        .IsComponentCreated = isObjectCreated,
                        .IsSavedToDb = (rc = "0")
                    })
                Next

                Return Ok(New With {
                    .Success = (successCount = request.Receipts.Count),
                    .ProcessedCount = successCount,
                    .TotalCount = request.Receipts.Count,
                    .Details = results
                })
            Catch ex As Exception
                Return InternalServerError(ex)
            End Try
        End Function
    End Class
End Namespace
