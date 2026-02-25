export interface AppConfig {
  apiKey: string;
  model: string;
}

let cachedConfig: AppConfig | null = null;

export const getAppConfig = async (): Promise<AppConfig> => {
  if (cachedConfig) return cachedConfig;

  try {
    // 使用相對路徑，確保在子目錄也能抓到
    const response = await fetch('api_config.json');
    if (response.ok) {
      const config = await response.json();
      cachedConfig = {
        apiKey: config.apiKey || import.meta.env.VITE_GPT_API_KEY || "",
        model: config.model || "gpt-4o"
      };
    }
  } catch (error) {
    console.warn("[Config] 無法讀取 api_config.json，將切換至環境變數:", error);
  }

  // 如果沒抓到或抓失敗，退而求其次使用環境變數
  if (!cachedConfig) {
    cachedConfig = {
      apiKey: import.meta.env.VITE_GPT_API_KEY || "",
      model: "gpt-5"
    };
  }

  return cachedConfig;
};

export const getOpenAIApiBase = () => {
  return import.meta.env.DEV ? "/api-openai" : "https://api.openai.com";
};
