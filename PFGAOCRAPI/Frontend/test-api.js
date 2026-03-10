import fs from 'fs';

async function testConnection() {
  console.log('正在測試 OpenAI API 連接...');
  
  let apiKey = null;
  let model = "gpt-4o-mini";

  // 1. Try public/api_config.json first
  try {
    const configData = fs.readFileSync('./public/api_config.json', 'utf8');
    const config = JSON.parse(configData);
    if (config.apiKey && config.apiKey.startsWith('sk-')) {
      apiKey = config.apiKey;
      model = config.model || model;
      console.log('ℹ️ 使用 public/api_config.json 中的設定');
    }
  } catch (err) {
    // Ignore if file doesn't exist or is invalid
  }

  // 2. Fallback to .env
  if (!apiKey) {
    try {
      const envContent = fs.readFileSync('.env', 'utf8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        if (line.startsWith('VITE_GPT_API_KEY=')) {
          apiKey = line.split('=')[1].trim().replace(/['"]/g, '');
          break;
        }
      }
      if (apiKey) console.log('ℹ️ 使用 .env 中的設定');
    } catch (err) {
      console.error('❌ 錯誤：找不到 .env 或 api_config.json 檔案');
      return;
    }
  }

  if (!apiKey || !apiKey.startsWith('sk-')) {
    console.error('❌ 錯誤：找不到有效的 API Key (需以 sk- 開頭)');
    return;
  }

  try {
    console.log(`測試模型: ${model}`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_completion_tokens: 10
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✅ 連接成功！OpenAI 回傳：', data.choices[0].message.content);
    } else {
      console.error('❌ 連接失敗：', data.error.message);
    }
  } catch (error) {
    console.error('❌ 發生錯誤：', error.message);
  }
}

testConnection();
