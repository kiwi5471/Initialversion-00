import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/PAFOCUS/ocr/',
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api-openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-openai/, ''),
        secure: false, // 解決 SSL 憑證驗證問題 (unable to get local issuer certificate)
        timeout: 300000, 
        proxyTimeout: 300000,
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
