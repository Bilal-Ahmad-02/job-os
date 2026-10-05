import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    cors: false,
    allowedHosts: ["127.0.0.1"],
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), display-capture=()",
    },
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // Never inline images as data: addresses; the production policy only allows files from the app.
  build: { target: "es2022", sourcemap: false, assetsInlineLimit: 0 },
});
