import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, 'OCR_LOG.txt');
const UPLOAD_DIR = path.join(__dirname, 'uploaded_files');

// 確保目錄存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const server = http.createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        if (req.url === '/log') {
          const timestamp = new Date().toLocaleString();
          const logEntry = `[${timestamp}] ${data.message}\n`;
          fs.appendFileSync(LOG_FILE, logEntry);
          console.log('已自動記錄效能數據:', data.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success' }));
        } 
        else if (req.url === '/save-file') {
          const { fileName, base64Data } = data;
          
          // 格式化時間戳記 (移除年份：2026-02-05... -> 02-05...)
          const timestamp = new Date().toISOString().substring(5).replace(/[:.]/g, '-');
          
          let finalFileName = "";
          // 處理 PDF 分頁的檔名格式：將 .pdf 移到最後面
          if (fileName.toLowerCase().includes('.pdf (第') && fileName.includes('頁)')) {
            const cleanBaseName = fileName.replace(/\.pdf\s*/i, '');
            finalFileName = `${timestamp}_${cleanBaseName}.pdf`;
          } else {
            finalFileName = `${timestamp}_${fileName}`;
          }

          const filePath = path.join(UPLOAD_DIR, finalFileName);
          
          fs.writeFileSync(filePath, base64Data, 'base64');
          console.log(`檔案已自動備份至: ${filePath}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', path: filePath }));
        }
        else {
          res.writeHead(404);
          res.end();
        }
      } catch (error) {
        console.error('處理請求失敗:', error);
        res.writeHead(400);
        res.end('Invalid request');
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 3001;
const HOST = '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`效能日誌伺服器已啟動：http://${HOST}:${PORT}`);
});
