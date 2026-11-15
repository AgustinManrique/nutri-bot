import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Permite importar la lógica compartida con el bot (../lib/nutricion.ts)
  server: { fs: { allow: ['..'] } },
});
