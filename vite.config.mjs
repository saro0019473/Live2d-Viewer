import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

/**
 * Custom Vite plugin that proxies cross-origin audio requests through the dev server.
 * This avoids CORS / COEP blocks when Live2D models reference audio files on external
 * servers (e.g. patchwiki.biligame.com).
 *
 * Usage from the client:  fetch(`/audio-proxy/${encodeURIComponent(externalUrl)}`)
 */
function audioProxyPlugin() {
  return {
    name: "audio-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only handle requests that start with /audio-proxy/
        if (!req.url || !req.url.startsWith("/audio-proxy/")) {
          return next();
        }

        try {
          // Extract the encoded URL after the prefix
          const encodedUrl = req.url.slice("/audio-proxy/".length);
          if (!encodedUrl) {
            res.statusCode = 400;
            res.end("Missing URL parameter");
            return;
          }

          const targetUrl = decodeURIComponent(encodedUrl);

          // Basic validation – only allow http(s) URLs
          if (
            !targetUrl.startsWith("http://") &&
            !targetUrl.startsWith("https://")
          ) {
            res.statusCode = 400;
            res.end("Invalid URL: must start with http:// or https://");
            return;
          }

          // Use native fetch (Node 18+) or dynamic import of node-fetch
          let fetchFn;
          if (typeof globalThis.fetch === "function") {
            fetchFn = globalThis.fetch;
          } else {
            // Fallback for older Node versions
            const mod = await import("node-fetch");
            fetchFn = mod.default;
          }

          const response = await fetchFn(targetUrl, {
            headers: {
              // Pretend to be a browser so the remote server doesn't reject us
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

          // Forward content-type so the browser knows it's audio
          const contentType =
            response.headers.get("content-type") || "audio/mpeg";
          const contentLength = response.headers.get("content-length");

          res.setHeader("Content-Type", contentType);
          if (contentLength) {
            res.setHeader("Content-Length", contentLength);
          }
          // Allow the page to use this resource despite COEP
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Access-Control-Allow-Origin", "*");
          // Cache for 1 hour to avoid re-fetching the same file
          res.setHeader("Cache-Control", "public, max-age=3600");

          res.statusCode = 200;

          // Pipe the response body to the client
          if (response.body && typeof response.body.pipe === "function") {
            // Node stream (node-fetch or Node 18+ with Readable.fromWeb)
            response.body.pipe(res);
          } else if (response.body) {
            // Web ReadableStream (Node 18+ native fetch)
            // Convert to Node Readable and pipe
            const { Readable } = await import("stream");
            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.pipe(res);
          } else {
            // Fallback: buffer the entire response
            const buffer = await response.arrayBuffer();
            res.end(Buffer.from(buffer));
          }
        } catch (err) {
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
    // Register the audio proxy plugin for dev server
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
        // Do NOT use drop_console: true — that would also drop console.warn
        // and console.error which are needed for runtime diagnostics in prod.
        drop_debugger: true,
        // Only strip the truly verbose / dev-only calls.
        pure_funcs: ["console.log", "console.debug", "console.info"],
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
