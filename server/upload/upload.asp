<%@ Language=VBScript %>
<%
Option Explicit
Response.ContentType = "application/json"

Const MAX_FILE_BYTES = 20971520 ' 20MB

Dim uploadFolder
uploadFolder = Server.MapPath("../uploads")

Dim uploader
Set uploader = New SimpleUploader
uploader.Save uploadFolder

If uploader.HasError Then
  Response.Status = "400 Bad Request"
  Response.Write "{""success"":false,""error"":""" & EscapeJson(uploader.ErrorMessage) & """}"
Else
  Response.Write "{""success"":true,""fileName"":""" & EscapeJson(uploader.OriginalFileName) & """,""serverPath"":""" & EscapeJson("/uploads/" & uploader.StoredFileName) & """}"
End If

Set uploader = Nothing

Class SimpleUploader
  Public HasError
  Public ErrorMessage
  Public OriginalFileName
  Public StoredFileName

  Public Sub Save(ByVal folderPath)
    HasError = False
    ErrorMessage = ""
    OriginalFileName = ""
    StoredFileName = ""

    Dim contentType
    contentType = Request.ServerVariables("CONTENT_TYPE")
    If InStr(contentType, "multipart/form-data") = 0 Then
      SetError "Only multipart/form-data is supported."
      Exit Sub
    End If

    Dim boundary
    boundary = "--" & Split(contentType, "boundary=")(1)

    Dim rawData
    rawData = Request.BinaryRead(Request.TotalBytes)

    Dim dataString
    dataString = BinaryToString(rawData)

    Dim parts
    parts = Split(dataString, boundary)

    Dim part
    For Each part In parts
      If InStr(part, "Content-Disposition") > 0 And InStr(part, "filename=") > 0 Then
        ProcessFilePart part, folderPath
        Exit Sub
      End If
    Next

    SetError "No file uploaded."
  End Sub

  Private Sub ProcessFilePart(ByVal part, ByVal folderPath)
    Dim headerEnd
    headerEnd = InStr(part, vbCrLf & vbCrLf)
    If headerEnd = 0 Then
      SetError "Invalid upload payload."
      Exit Sub
    End If

    Dim headerBlock
    headerBlock = Left(part, headerEnd - 1)

    Dim filename
    filename = ExtractFilename(headerBlock)
    If filename = "" Then
      SetError "Missing filename."
      Exit Sub
    End If

    Dim fileBody
    fileBody = Mid(part, headerEnd + 4)

    If Right(fileBody, 2) = vbCrLf Then
      fileBody = Left(fileBody, Len(fileBody) - 2)
    End If

    Dim fileBytes
    fileBytes = StringToBinary(fileBody)

    If UBound(fileBytes) + 1 > MAX_FILE_BYTES Then
      SetError "File exceeds 20MB limit."
      Exit Sub
    End If

    Dim fso
    Set fso = Server.CreateObject("Scripting.FileSystemObject")
    If Not fso.FolderExists(folderPath) Then
      fso.CreateFolder folderPath
    End If

    OriginalFileName = filename
    StoredFileName = BuildStoredName(filename)

    Dim stream
    Set stream = Server.CreateObject("ADODB.Stream")
    stream.Type = 1
    stream.Open
    stream.Write fileBytes
    stream.SaveToFile folderPath & "\" & StoredFileName, 2
    stream.Close

    Set stream = Nothing
    Set fso = Nothing
  End Sub

  Private Function ExtractFilename(ByVal headers)
    Dim filenamePos
    filenamePos = InStr(headers, "filename=")
    If filenamePos = 0 Then
      ExtractFilename = ""
      Exit Function
    End If

    Dim raw
    raw = Mid(headers, filenamePos + 9)
    raw = Replace(raw, "\"", "")
    raw = Replace(raw, """", "")
    raw = Split(raw, vbCrLf)(0)
    raw = Trim(raw)

    Dim parts
    parts = Split(raw, "\\")
    ExtractFilename = parts(UBound(parts))
  End Function

  Private Function BuildStoredName(ByVal filename)
    Dim safeName
    safeName = Replace(filename, " ", "_")
    safeName = Replace(safeName, ":", "_")
    safeName = Replace(safeName, "/", "_")
    safeName = Replace(safeName, "\\", "_")
    BuildStoredName = Year(Now()) & Right("0" & Month(Now()), 2) & Right("0" & Day(Now()), 2) & "_" & Right("0" & Hour(Now()), 2) & Right("0" & Minute(Now()), 2) & Right("0" & Second(Now()), 2) & "_" & safeName
  End Function

  Private Sub SetError(ByVal message)
    HasError = True
    ErrorMessage = message
  End Sub
End Class

Function BinaryToString(ByVal bytes)
  Dim stream
  Set stream = Server.CreateObject("ADODB.Stream")
  stream.Type = 1
  stream.Open
  stream.Write bytes
  stream.Position = 0
  stream.Type = 2
  stream.Charset = "iso-8859-1"
  BinaryToString = stream.ReadText
  stream.Close
  Set stream = Nothing
End Function

Function StringToBinary(ByVal str)
  Dim stream
  Set stream = Server.CreateObject("ADODB.Stream")
  stream.Type = 2
  stream.Charset = "iso-8859-1"
  stream.Open
  stream.WriteText str
  stream.Position = 0
  stream.Type = 1
  StringToBinary = stream.Read
  stream.Close
  Set stream = Nothing
End Function

Function EscapeJson(ByVal value)
  value = Replace(value, "\\", "\\\\")
  value = Replace(value, """", "\\\"")
  value = Replace(value, vbCrLf, "\\n")
  value = Replace(value, vbCr, "\\n")
  value = Replace(value, vbLf, "\\n")
  EscapeJson = value
End Function
%>
