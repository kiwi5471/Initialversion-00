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

  console.log('[UserInfo] URL Extracted:', { name, userid });
  
  return { name, userid };
}

export function getApiBase() {
  const isDev = import.meta.env.DEV;
  // 開發時連到 3001，正式版改用 Vite 配置的 base 路徑
  return isDev ? "http://127.0.0.1:3001" : import.meta.env.BASE_URL.replace(/\/$/, "");
}
