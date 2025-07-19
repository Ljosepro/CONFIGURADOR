import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/BEATOREACT2/', // Configuración correcta para GitHub Pages
  plugins: [react()],
});
