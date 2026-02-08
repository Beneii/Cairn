import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    host: true,            // Bind 0.0.0.0 — accessible from phone, Tailscale, etc.
    allowedHosts: 'all',   // Allow any hostname (Tailscale IPs, VPN, etc.)
    proxy: {
      '/ws': {
        target: `ws://localhost:${process.env.GATEWAY_PORT || 3100}`,
        ws: true,
      },
      '/health': {
        target: `http://localhost:${process.env.GATEWAY_PORT || 3100}`,
      },
    },
  },
})
