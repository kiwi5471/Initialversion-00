<%@ Language="VBScript" %>
<%
' ---------------------------------------------------------
' OCR Save File & Log ASP
' ---------------------------------------------------------
' *** UNC 存取路徑設定 (請依實際環境修改) ***
Const UNC_PATH     = "\\10.90.118.89\Upload\OCR"
' *** 設定結束 ***

Session.CodePage = 65001
Response.CodePage = 65001
Response.ContentType = "application/json"
Response.Charset = "utf-8"
Server.ScriptTimeout = 600
On Error Resume Next

Dim fso
Set fso = Server.CreateObject("Scripting.FileSystemObject")

' Log path
Dim logPath: logPath = Server.MapPath("OCR_LOG.txt")

' -------------------------------------------------------
' WriteLog: append to OCR_LOG.txt (Big5 via ADODB.Stream)
' -------------------------------------------------------
Sub WriteLog(msg)
    On Error Resume Next
    Dim strMsg: strMsg = Now & " " & msg & vbCrLf
    Dim stm: Set stm = Server.CreateObject("ADODB.Stream")
    stm.Type = 2
    stm.Charset = "utf-8"
    stm.Open

    If fso.FileExists(logPath) Then
        Dim oldStm: Set oldStm = Server.CreateObject("ADODB.Stream")
        oldStm.Type = 2: oldStm.Charset = "utf-8": oldStm.Open
        oldStm.LoadFromFile logPath
        Dim existingText: existingText = oldStm.ReadText
        oldStm.Close: Set oldStm = Nothing
        ' 移除 UTF-8 BOM (如果有的話)
        If Left(existingText, 1) = Chr(65279) Then existingText = Mid(existingText, 2)
        stm.WriteText existingText
    End If

    stm.WriteText strMsg
    stm.SaveToFile logPath, 2
    stm.Close: Set stm = Nothing
End Sub

' -------------------------------------------------------
' 1. Verify request has data
' -------------------------------------------------------
WriteLog "======== Request received ========"

Dim totalBytes: totalBytes = Request.TotalBytes
If totalBytes <= 0 Then
    WriteLog "Error: No data (TotalBytes=0)"
    Response.Write "{""status"": ""error"", ""message"": ""No data""}"
    Response.End
End If

' -------------------------------------------------------
' 2. Read binary, decode as UTF-8 for JSON parsing
' -------------------------------------------------------
Dim postData: postData = Request.BinaryRead(totalBytes)
If Err.Number <> 0 Then
    WriteLog "Error (BinaryRead): " & Err.Description
    Response.Write "{""status"": ""error"", ""message"": ""Read failed""}"
    Response.End
End If

Dim inputStream: Set inputStream = Server.CreateObject("ADODB.Stream")
inputStream.Type = 1: inputStream.Open
inputStream.Write postData
inputStream.Position = 0
inputStream.Type = 2: inputStream.Charset = "utf-8"
Dim jsonStr: jsonStr = inputStream.ReadText
inputStream.Close: Set inputStream = Nothing

WriteLog "JSON length: " & Len(jsonStr)

' -------------------------------------------------------
' 3. Parse JSON fields
' -------------------------------------------------------
Dim fnKey:    fnKey    = """fileName"":"""
Dim b64Key:   b64Key   = """base64Data"":"""
Dim userKey:  userKey  = """name"":"""
Dim uidKey:   uidKey   = """userid"":"""
Dim modelKey: modelKey = """model"":"""
Dim msgKey:   msgKey   = """message"":"""

Dim fnPos:    fnPos    = InStr(jsonStr, fnKey)
Dim b64Pos:   b64Pos   = InStr(jsonStr, b64Key)
Dim userPos:  userPos  = InStr(jsonStr, userKey)
Dim uidPos:   uidPos   = InStr(jsonStr, uidKey)
Dim modelPos: modelPos = InStr(jsonStr, modelKey)
Dim msgPos:   msgPos   = InStr(jsonStr, msgKey)

Dim currentUserName: currentUserName = "Unknown"
Dim currentUserId:   currentUserId   = "Unknown"
Dim currentModel:    currentModel    = "Unknown"

If userPos > 0 Then
    Dim uStart: uStart = userPos + Len(userKey)
    currentUserName = Mid(jsonStr, uStart, InStr(uStart, jsonStr, """") - uStart)
End If

If uidPos > 0 Then
    Dim iStart: iStart = uidPos + Len(uidKey)
    currentUserId = Mid(jsonStr, iStart, InStr(iStart, jsonStr, """") - iStart)
End If

If modelPos > 0 Then
    Dim mStart: mStart = modelPos + Len(modelKey)
    currentModel = Mid(jsonStr, mStart, InStr(mStart, jsonStr, """") - mStart)
End If

WriteLog "User: " & currentUserName & " (ID: " & currentUserId & ") [Model: " & currentModel & "]"

' -------------------------------------------------------
' 4. Route: save file or write log
' -------------------------------------------------------
If fnPos > 0 And b64Pos > 0 Then

    Dim fileName, base64Data, startPos, endPos

    startPos = fnPos + Len(fnKey)
    endPos   = InStr(startPos, jsonStr, """")
    fileName = Mid(jsonStr, startPos, endPos - startPos)

    startPos   = b64Pos + Len(b64Key)
    endPos     = InStr(startPos, jsonStr, """")
    base64Data = Mid(jsonStr, startPos, endPos - startPos)

    If InStr(base64Data, "base64,") > 0 Then
        base64Data = Mid(base64Data, InStr(base64Data, "base64,") + 7)
    End If

    WriteLog "Saving file: " & fileName & " (Base64 len: " & Len(base64Data) & ")"

    Dim saveDir: saveDir = UNC_PATH
    WriteLog "Target dir: " & saveDir

    If Not fso.FolderExists(saveDir) Then
        Err.Clear
        fso.CreateFolder(saveDir)
        If Err.Number <> 0 Then
            WriteLog "CreateFolder failed: " & Err.Description
            Response.Write "{""status"": ""error"", ""message"": ""Cannot create uploaded_files dir: " & Replace(Err.Description, """", "'") & """}"
            Response.End
        End If
        WriteLog "Created dir: " & saveDir
    End If

    Dim tNow: tNow = Now
    Dim tsPrefix: tsPrefix = Year(tNow) & "-" & Right("0" & Month(tNow), 2) & "-" & Right("0" & Day(tNow), 2) & "T" & _
                             Right("0" & Hour(tNow), 2) & "-" & Right("0" & Minute(tNow), 2) & "-" & Right("0" & Second(tNow), 2) & "Z_"

    Dim finalFileName: finalFileName = tsPrefix & fileName
    Dim savePath:      savePath      = saveDir & "\" & finalFileName
    WriteLog "Save path: " & savePath

    ' Decode Base64 via MSXML2
    Err.Clear
    Dim xml: Set xml = Server.CreateObject("MSXML2.DOMDocument")
    Dim node: Set node = xml.CreateElement("tmp")
    node.dataType = "bin.base64"
    node.text = base64Data
    Dim binData: binData = node.nodeTypedValue
    If Err.Number <> 0 Then
        WriteLog "Base64 decode failed: " & Err.Description
        Response.Write "{""status"": ""error"", ""message"": ""Base64 decode error: " & Replace(Err.Description, """", "'") & """}"
        Set node = Nothing: Set xml = Nothing
        Response.End
    End If
    Set node = Nothing: Set xml = Nothing
    WriteLog "Base64 decoded OK, writing binary..."

    ' Write binary to file
    Err.Clear
    Dim outStream: Set outStream = Server.CreateObject("ADODB.Stream")
    outStream.Type = 1
    outStream.Open
    outStream.Write binData
    outStream.SaveToFile savePath, 2

    Dim saveErr: saveErr = Err.Number
    Dim saveErrDesc: saveErrDesc = Err.Description

    outStream.Close: Set outStream = Nothing

    If saveErr <> 0 Then
        WriteLog "Save failed: " & saveErrDesc & " | path: " & savePath
        Response.Write "{""status"": ""error"", ""message"": """ & Replace(saveErrDesc, """", "'") & """}"
    Else
        WriteLog "Saved OK: " & finalFileName
        Response.Write "{""status"": ""success"", ""path"": ""uploaded_files/" & finalFileName & """}"
    End If

Else

    Dim logMessage: logMessage = ""
    If msgPos > 0 Then
        Dim mLogStart: mLogStart = msgPos + Len(msgKey)
        logMessage = Mid(jsonStr, mLogStart, InStr(mLogStart, jsonStr, """") - mLogStart)
    End If

    If logMessage = "" Then logMessage = jsonStr

    ' 提取 detail 欄位（整個 JSON 物件）
    Dim detKey: detKey = """detail"":"
    Dim detPos: detPos = InStr(jsonStr, detKey)
    Dim detailStr: detailStr = ""
    If detPos > 0 Then
        Dim detStart: detStart = detPos + Len(detKey)
        detailStr = Trim(Mid(jsonStr, detStart))
        ' 移除外層 JSON 結尾的 }
        If Right(detailStr, 1) = "}" Then detailStr = Left(detailStr, Len(detailStr) - 1)
        detailStr = Trim(detailStr)
    End If

    WriteLog "[DevMode] " & logMessage
    If detailStr <> "" And detailStr <> "null" Then
        WriteLog "[Detail] " & detailStr
    End If
    WriteLog "----------------------------------------"
    Response.Write "{""status"": ""success"", ""message"": ""Log written""}"

End If

Set fso = Nothing
%>
