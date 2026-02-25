<%@ Language="VBScript" CODEPAGE=65001 %>
<%
Response.CodePage  = 65001
Response.ContentType = "application/json"
Response.Charset   = "utf-8"
Response.Buffer    = False
Server.ScriptTimeout = 600
On Error Resume Next

' -------------------------------------------------------
' 1. 讀取 POST body (UTF-8 JSON)
' -------------------------------------------------------
Dim totalBytes: totalBytes = Request.TotalBytes
If totalBytes <= 0 Then
    Response.Write "{""error"":""No data""}"
    Response.End
End If

Dim rawPost: rawPost = Request.BinaryRead(totalBytes)
Dim inStm: Set inStm = Server.CreateObject("ADODB.Stream")
inStm.Type = 1: inStm.Open
inStm.Write rawPost
inStm.Position = 0
inStm.Type = 2: inStm.Charset = "utf-8"
Dim jsonStr: jsonStr = inStm.ReadText
inStm.Close: Set inStm = Nothing

' -------------------------------------------------------
' 2. 解析 folderPath
' -------------------------------------------------------
Dim fpKey: fpKey = """folderPath"":"""
Dim fpPos: fpPos = InStr(jsonStr, fpKey)
Dim folderPath: folderPath = ""

If fpPos > 0 Then
    Dim fpStart: fpStart = fpPos + Len(fpKey)
    ' JSON 中 \ 會被 escape 成 \\，需還原
    Dim rawPath: rawPath = Mid(jsonStr, fpStart, InStr(fpStart, jsonStr, """") - fpStart)
    folderPath = Replace(rawPath, "\\", "\")
End If

If folderPath = "" Then
    Response.Write "{""error"":""folderPath required""}"
    Response.End
End If

' -------------------------------------------------------
' 3. 確認資料夾存在
' -------------------------------------------------------
Dim fso: Set fso = Server.CreateObject("Scripting.FileSystemObject")

If Not fso.FolderExists(folderPath) Then
    Response.Write "{""error"":""Folder not found: " & Replace(folderPath, """", "'") & """}"
    Set fso = Nothing
    Response.End
End If

' -------------------------------------------------------
' 4. 掃描支援的檔案，逐筆輸出 JSON
' -------------------------------------------------------
Dim supportedExts: supportedExts = "|pdf|jpg|jpeg|png|webp|"

Response.Write "{""files"":["
Dim first: first = True

Dim folder: Set folder = fso.GetFolder(folderPath)
Dim oFile
For Each oFile In folder.Files

    Dim ext: ext = LCase(fso.GetExtensionName(oFile.Name))
    If InStr(supportedExts, "|" & ext & "|") > 0 Then

        ' --- 讀取原始 Binary ---
        Dim binStm: Set binStm = Server.CreateObject("ADODB.Stream")
        binStm.Type = 1: binStm.Open
        Err.Clear
        binStm.LoadFromFile oFile.Path
        If Err.Number <> 0 Then
            binStm.Close: Set binStm = Nothing
        Else
            ' --- 判斷 MIME Type ---
            Dim mimeType: mimeType = "image/jpeg"
            Dim isActualPdf: isActualPdf = "false"

            If ext = "png" Then
                mimeType = "image/png"
            ElseIf ext = "webp" Then
                mimeType = "image/webp"
            ElseIf ext = "pdf" Then
                ' 讀取前 4 bytes 判斷是否為真正的 PDF
                binStm.Position = 0
                Dim magic4: magic4 = binStm.Read(4)
                ' 轉成 Latin-1 字串比對 magic bytes
                Dim magTxt: Set magTxt = Server.CreateObject("ADODB.Stream")
                magTxt.Type = 1: magTxt.Open
                magTxt.Write magic4
                magTxt.Position = 0
                magTxt.Type = 2: magTxt.Charset = "iso-8859-1"
                Dim hdr: hdr = magTxt.ReadText
                magTxt.Close: Set magTxt = Nothing

                If Left(hdr, 4) = "%PDF" Then
                    mimeType = "application/pdf"
                    isActualPdf = "true"
                ElseIf AscW(Mid(hdr,1,1)) = &H89 Then
                    mimeType = "image/png"
                ElseIf AscW(Mid(hdr,1,1)) = &HFF And AscW(Mid(hdr,2,1)) = &HD8 Then
                    mimeType = "image/jpeg"
                Else
                    mimeType = "application/pdf"
                    isActualPdf = "true"
                End If
            End If

            ' --- Base64 編碼 ---
            binStm.Position = 0
            Dim xmlDoc: Set xmlDoc = Server.CreateObject("MSXML2.DOMDocument")
            Dim xmlNode: Set xmlNode = xmlDoc.CreateElement("b")
            xmlNode.dataType = "bin.base64"
            xmlNode.nodeTypedValue = binStm.Read()
            Dim b64: b64 = xmlNode.text
            ' 移除 MSXML2 自動插入的換行
            b64 = Join(Split(b64, vbCrLf), "")
            b64 = Join(Split(b64, vbLf), "")
            b64 = Join(Split(b64, vbCr), "")
            Set xmlNode = Nothing: Set xmlDoc = Nothing
            binStm.Close: Set binStm = Nothing

            ' --- 輸出 JSON 物件 ---
            Dim safeName: safeName = Replace(oFile.Name, "\", "\\")
            safeName = Replace(safeName, """", "\""")

            If Not first Then Response.Write ","
            Response.Write "{""fileName"":""" & safeName & ""","
            Response.Write """base64Data"":""data:" & mimeType & ";base64," & b64 & ""","
            Response.Write """isActualPdf"":" & isActualPdf & "}"
            first = False
        End If

    End If
Next

Set folder = Nothing
Set fso = Nothing

Response.Write "]}"
%>
