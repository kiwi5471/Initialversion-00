# ASP (VBScript) 上傳服務

此資料夾提供 Classic ASP + VBScript 的上傳端點，讓前端把掃描檔案存到伺服器指定資料夾。

## 目錄結構

- `upload/upload.asp`: 上傳處理端點（接收 `multipart/form-data`）
- `uploads/`: 檔案儲存目錄（預設）

## IIS 本機啟動方式

1. 於 Windows 安裝 IIS（含 ASP Classic）。
2. 把專案或 `server` 資料夾設定為 IIS 虛擬目錄。
3. 確保 `server/uploads` 具有可寫入權限。
4. 存取 `http://localhost/<your-virtual-dir>/upload/upload.asp` 做上傳測試。

## 回傳格式

`upload.asp` 會回傳 JSON：

```json
{
  "success": true,
  "fileName": "original.pdf",
  "serverPath": "/uploads/20240101_120000_original.pdf"
}
```

## 前端設定

前端預設會呼叫 `/upload/upload.asp` 上傳檔案；若 IIS 虛擬目錄路徑不同，可在前端設定環境變數：

```
VITE_UPLOAD_ENDPOINT=/your-virtual-dir/upload/upload.asp
```

## 可調整項目

- `upload/upload.asp` 的 `MAX_FILE_BYTES`：限制上傳大小（預設 20MB）。
- `upload/upload.asp` 的 `uploadFolder`：檔案實際儲存路徑（預設 `../uploads`）。
