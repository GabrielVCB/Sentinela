import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { painelPreviewPlugin } from "./scripts/painel-preview-plugin";

const portaPainelPreview = process.env.SENTINELA_PREVIEW_PANEL_PORT || "5001";
const destinosPainel = [
  "/painel",
  "/login",
  "/logout",
  "/api",
  "/static",
  "/downloads",
  "/detectores.js",
  "/favicon.ico",
];
const proxyPainel: Record<string, { target: string }> = Object.fromEntries(
  destinosPainel.map((destino) => [
    destino,
    { target: `http://127.0.0.1:${portaPainelPreview}` },
  ]),
);

// Na prévia, a raiz serve a landing oficial do Flask. Assim o que aparece no
// navegador é exatamente o que será publicado, sem duas versões da página.
proxyPainel["^/$"] = { target: `http://127.0.0.1:${portaPainelPreview}` };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vlyPlugin(), tailwindcss(), painelPreviewPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of React across all packages (including vlyPlugin).
    // Without this, @vly-ai/integrations can resolve its own React copy, which
    // triggers "Invalid hook call" errors at runtime.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and lazy loading
        manualChunks: {
          // Vendor chunks for large libraries
          'react-vendor': ['react', 'react-dom', 'react-router'],
          // Biblioteca de animação usada pela landing da prévia.
          'framer-motion': ['framer-motion'],
        },
        // Optimize chunk size
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit for better chunking
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    // Only scan the app entry HTML; avoids crawling unrelated *.html files
    // if a legacy snapshot accidentally contains leaked package folders.
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      'framer-motion',
      // vlyPlugin() injects this import at serve time, so the dep scanner
      // never sees it. Without it here the first page load discovers it,
      // re-optimizes and full-reloads the preview mid-screenshot.
      '@vly-ai/integrations',
    ],
  },
  // Performance hints
  server: {
    // Bind to all interfaces so the browser runtime's server-ready event fires.
    host: true,
    port: 5173,
    // O painel Flask roda ao lado do Vite no preview. O proxy mantém o mesmo
    // host (localhost:5173), então sessão, cookies e redirecionamentos do
    // painel continuam funcionando como no servidor publicado.
    proxy: proxyPainel,
    // O Postgres embutido grava muitos arquivos; não deixe o watcher do Vite
    // interpretar cada escrita do banco como mudança da aplicação.
    watch: {
      ignored: ["**/.preview/**", "**/__pycache__/**"],
    },
    // Keep HMR on, but disable full-screen error overlay
    hmr: {
      overlay: false,
    },
  },
});
