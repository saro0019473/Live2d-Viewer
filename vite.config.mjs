import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        "vue",
        {
          "naive-ui": [
            "useDialog",
            "useMessage",
            "useNotification",
            "useLoadingBar",
          ],
        },
      ],
      dts: false,
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: false,
    }),
  ],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: [
          "console.log",
          "console.debug",
          "console.info",
          "console.warn",
        ],
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vue-core": ["vue", "pinia"],
          "naive-ui": ["naive-ui"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
    proxy: {
      "/live2d-models": {
        target: "http://localhost:12393",
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
  optimizeDeps: {
    exclude: ["electron"],
  },
  assetsInclude: ["**/*.model", "**/*.json"],
  publicDir: "public",
});
