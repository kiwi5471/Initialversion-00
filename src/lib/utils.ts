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
