import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeJsonParse(text: string) {
  try {
    // 移除 Markdown 代碼塊標記 (例如 ```json ... ```)
    const cleaner = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
    return JSON.parse(cleaner);
  } catch (e) {
    // 如果還是失敗，嘗試進階清洗：只抓取第一個 { 到最後一個 } 之間的內容
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (e2) {
      console.error("JSON Parse failed even after cleaning:", e2);
    }
    throw e;
  }
}

export async function base64ToFile(base64Data: string, fileName: string, mimeType: string): Promise<File> {
  const res = await fetch(base64Data);
  const blob = await res.blob();
  return new File([blob], fileName, { type: mimeType });
}

/**
 * 根據資料庫定長規範，檢核 OCR 欄位長度是否超限
 * @param data OCR 識別結果
 * @returns 錯誤訊息陣列，若無錯誤則長度為 0
 */
export function validateOCRFieldLengths(data: any): string[] {
  const errors: string[] = [];

  const rules = [
    { field: "supplier_name", label: "賣方名稱", maxLength: 200 },
    { field: "buyer_name", label: "買受人名稱", maxLength: 200 },
    { field: "invoice_number", label: "發票號碼", maxLength: 20 },
    { field: "filename", label: "檔名", maxLength: 200 },
    { field: "filepath", label: "檔案路徑", maxLength: 200 },
    { field: "remark", label: "備註", maxLength: 200 }
  ];

  rules.forEach(rule => {
    const value = data[rule.field] || "";
    if (value.toString().length > rule.maxLength) {
      errors.push(`${rule.label} 超過長度上限 (${rule.maxLength} 字)`);
    }
  });

  // 注意：業務邏輯檢核已主要遷移至後端 API，前端此處保留基礎 UI 提示
  // 以確保使用者在送出前能獲得即時回饋
  if (data.is_reused === "Y" || data.is_reused === true) {
    return [];
  }

  return errors;
}

export function getURLUserInfo() {
  const searchPart = window.location.search;
  const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';

  const decodeValue = (val: string) => {
    if (!val) return "";

    // 將 URL 編碼轉換回位元組陣列
    const bytes: number[] = [];
    for (let i = 0; i < val.length; i++) {
      if (val[i] === '%' && i + 2 < val.length) {
        const hex = val.substring(i + 1, i + 3);
        if (/[0-9a-f]{2}/i.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      bytes.push(val.charCodeAt(i));
    }
    const byteArray = new Uint8Array(bytes);

    // 依照要求：預設直接使用 Big5 解碼 (針對台灣舊系統)
    try {
      const decoder = new TextDecoder('big5');
      return decoder.decode(byteArray).replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    } catch (e) {
      // 萬一 Big5 解碼失敗，才用 UTF-8 當備案
      try {
        return decodeURIComponent(val);
      } catch (e2) {
        return val;
      }
    }
  };

  const getParamFromRaw = (raw: string, keys: string[]) => {
    if (!raw) return null;
    const pairs = raw.replace(/^\?/, '').split('&');
    for (const pair of pairs) {
      const [pKey, pVal] = pair.split('=');
      if (keys.map(k => k.toLowerCase()).includes((pKey || "").toLowerCase())) {
        return decodeValue(pVal || "");
      }
    }
    return null;
  };

  const name = getParamFromRaw(searchPart, ['username', 'name']) ||
    getParamFromRaw(hashPart, ['username', 'name']) ||
    'Unknown';

  const userid = getParamFromRaw(searchPart, ['userid', 'user_id', 'id']) ||
    getParamFromRaw(hashPart, ['userid', 'user_id', 'id']) ||
    'Unknown';

  const company = getParamFromRaw(searchPart, ['company', 'comp']) ||
    getParamFromRaw(hashPart, ['company', 'comp']) ||
    'T';

  const dept = getParamFromRaw(searchPart, ['dept']) ||
    getParamFromRaw(hashPart, ['dept']) ||
    '0000';

  console.log('[UserInfo] URL Extracted:', { name, userid, company, dept });

  return { name, userid, company, dept };
}

export function getApiBase() {
  const isDev = import.meta.env.DEV;
  // 重要：ASP.NET Web API 預設路徑通常包含 /api
  // 如果部署在 IIS 的 PFGAOCRAPI 虛擬目錄下，完整的 Base URL 應為 /PFGAOCRAPI/api
  // 修正：如果部署環境與前端編譯後的檔案在同一個目錄（/PFGAOCRAPI/dist），則可以使用相對路徑或更精確的絕對路徑
  if (isDev) return "http://localhost:3001";

  // 根據要求：如果部署環境在 /PFGAOCRAPI/dist，則 VB API 應該在 /PFGAOCRAPI/api
  return "https://test.panasonic.com.tw/PFGAOCRAPI/api";
}

// 新增一個專門用於存取靜態檔案（如 uploaded_files）的 Base URL
export function getStaticBase() {
  const isDev = import.meta.env.DEV;
  if (isDev) return "http://localhost:3001";
  return "https://test.panasonic.com.tw/PFGAOCRAPI";
}
