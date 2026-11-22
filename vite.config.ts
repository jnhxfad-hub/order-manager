import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  /**
   * 为 Tauri 开发定制的 Vite 选项，仅在 `tauri dev` 或 `tauri build` 中应用
   */

  // 1. 防止 Vite 隐藏 Rust 错误
  clearScreen: false,
  // 2. Tauri 需要一个固定端口，如果该端口不可用则失败
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. 告诉 Vite 忽略对 `src-tauri` 的监视
      ignored: ["**/src-tauri/**"],
    },
  },
}));
