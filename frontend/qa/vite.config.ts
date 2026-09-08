import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  cacheDir: 'node_modules/.vite-qa',
  root: fileURLToPath(new URL('../', import.meta.url)),
  plugins: [
    { name:'local-design-fixtures', enforce:'pre',
      resolveId(id) { if (/supabaseClient$/.test(id)) return fileURLToPath(new URL('./supabase.fixture.ts', import.meta.url)); },
      transformIndexHtml(html) { return html.replace('<body>', '<body><div style="position:fixed;bottom:5px;right:8px;z-index:3000;padding:3px 8px;border-radius:5px;background:#153d2d;color:#eef7e8;font:9px sans-serif;pointer-events:none">LOCAL DESIGN PREVIEW · SYNTHETIC RECORDS</div>'); }
    }, react()
  ],
  server:{host:'127.0.0.1',port:4173,strictPort:true}
});
