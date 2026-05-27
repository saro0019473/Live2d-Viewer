/**
 * vite.config.ts — Build & Dev Server Configuration
 *
 * Notable setup:
 *   - AutoImport: auto-imports Vue Composition API + Naive UI composables
 *     so components don't need manual `import { ref } from 'vue'` etc.
 *   - Components (NaiveUiResolver): auto-registers Naive UI components globally
 *     (NButton, NInput, etc.) without explicit imports in each .vue file
 *   - audioProxyPlugin: proxies `/audio-proxy/<encoded-url>` to bypass CORS
 *     restrictions on audio files from external Live2D model servers
 *   - COOP/COEP headers: required for SharedArrayBuffer (used by some audio
 *     worklets); note these headers may cause issues with some iframe embeds
 *   - manualChunks: separates vue+pinia and naive-ui into their own JS chunks
 *     for better browser caching
 *   - `base: './'`: enables relative asset paths so the build can be served
 *     from any subdirectory (important for the Electron shell path)
 *
 * The @ alias maps to src/ — use `@/components/...` in imports.
 */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

/**
 * Custom Vite plugin that proxies cross-origin audio requests through the dev server.
 */
function audioProxyPlugin() {
  return {
    name: "audio-proxy",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith("/audio-proxy/")) {
          return next();
        }

        try {
          const encodedUrl = req.url.slice("/audio-proxy/".length);
          if (!encodedUrl) {
            res.statusCode = 400;
            res.end("Missing URL parameter");
            return;
          }

          const targetUrl = decodeURIComponent(encodedUrl);

          if (
            !targetUrl.startsWith("http://") &&
            !targetUrl.startsWith("https://")
          ) {
            res.statusCode = 400;
            res.end("Invalid URL: must start with http:// or https://");
            return;
          }

          let fetchFn: any;
          if (typeof globalThis.fetch === "function") {
            fetchFn = globalThis.fetch;
          } else {
            const mod = await import("node-fetch");
            fetchFn = mod.default;
          }

          const response = await fetchFn(targetUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "audio/*,*/*;q=0.9",
              Referer: new URL(targetUrl).origin + "/",
            },
          });

          if (!response.ok) {
            res.statusCode = response.status;
            res.end(`Upstream returned ${response.status}`);
            return;
          }

          const contentType =
            response.headers.get("content-type") || "audio/mpeg";
          const contentLength = response.headers.get("content-length");

          res.setHeader("Content-Type", contentType);
          if (contentLength) {
            res.setHeader("Content-Length", contentLength);
          }
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cache-Control", "public, max-age=3600");

          res.statusCode = 200;

          if (response.body && typeof response.body.pipe === "function") {
            response.body.pipe(res);
          } else if (response.body) {
            const { Readable } = await import("stream");
            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.pipe(res);
          } else {
            const buffer = await response.arrayBuffer();
            res.end(Buffer.from(buffer));
          }
        } catch (err: any) {
          console.error("[audio-proxy] Error:", err.message);
          if (!res.headersSent) {
            res.statusCode = 502;
            res.end(`Audio proxy error: ${err.message}`);
          }
        }
      });
    },
  };
}

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
    audioProxyPlugin(),
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
        drop_debugger: true,
        // Strip dev-only logging from production bundle
        pure_funcs: ["console.log", "console.debug", "console.info"],
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy UI framework into its own cacheable chunk
          "vue-core": ["vue", "pinia"],
          "naive-ui": ["naive-ui"],
          // PIXI.js and Cubism are loaded dynamically at runtime (not here)
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
