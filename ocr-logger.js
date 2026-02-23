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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
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
          const { message, detail } = data;
          let logEntry = `[${timestamp}] ${message}\n`;
          
          if (detail) {
            logEntry += `>>> 辨識結果明細:\n${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}\n`;
            logEntry += `================================================================\n`;
          }
          
          fs.appendFileSync(LOG_FILE, logEntry);
          console.log('已記錄數據:', message, detail ? '(含明細)' : '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success' }));
        } 
        else if (req.url === '/save-file') {
          const { fileName, base64Data } = data;
          
          const timestamp = new Date().toISOString().substring(5).replace(/[:.]/g, '-');
          
          let finalFileName = "";
          if (fileName.toLowerCase().includes('.pdf (第') && fileName.includes('頁)')) {
            // 將 .pdf 移除，並在最後加上 .png，因為這些是轉換後的頁面圖片
            const cleanBaseName = fileName.replace(/\.pdf\s*/i, '');
            finalFileName = `${timestamp}_${cleanBaseName}.png`;
          } else {
            const ext = path.extname(fileName);
            if (!ext) {
              finalFileName = `${timestamp}_${fileName}.png`;
            } else {
              finalFileName = `${timestamp}_${fileName}`;
            }
          }

          const filePath = path.join(UPLOAD_DIR, finalFileName);
          
          fs.writeFileSync(filePath, base64Data, 'base64');
          console.log(`檔案已自動備份至: ${filePath}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', path: filePath }));
        }
        else if (req.url === '/scan-folder') {
          const { folderPath } = data;
          try {
            if (!fs.existsSync(folderPath)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '找不到路徑' }));
              return;
            }

            const files = fs.readdirSync(folderPath);
            const supportedFiles = files.filter(f => {
              const ext = path.extname(f).toLowerCase();
              return ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext);
            });

            const results = supportedFiles.map(file => {
              const filePath = path.join(folderPath, file);
              const buffer = fs.readFileSync(filePath);
              const content = buffer.toString('base64');
              const ext = path.extname(file).toLowerCase();
              
              let mimeType = 'image/jpeg';
              if (ext === '.png') mimeType = 'image/png';
              else if (ext === '.webp') mimeType = 'image/webp';
              else if (ext === '.pdf') {
                // 檢查是否其實是 PNG/JPG (檢查文件頭)
                if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                  mimeType = 'image/png';
                } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
                  mimeType = 'image/jpeg';
                } else {
                  mimeType = 'application/pdf'; // 真正的 PDF
                }
              }
              
              return {
                fileName: file,
                base64Data: `data:${mimeType};base64,${content}`,
                isActualPdf: mimeType === 'application/pdf'
              };
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files: results }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
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
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`效能日誌伺服器已啟動: http://localhost:${PORT}`);
});
