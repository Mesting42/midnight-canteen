import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build:{rollupOptions:{input:{game:resolve('index.html'),assetPreview:resolve('asset-preview.html')}}},
});
