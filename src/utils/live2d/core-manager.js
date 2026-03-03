/**
 * Live2D Core Manager
 * Responsible for PIXI application initialization, base settings, and lifecycle management
 */

import {
  waitForLive2D,
  createLogger,
  getRecommendedSettings,
} from "./utils.js";

export class Live2DCoreManager {
  constructor(container) {
    this.container = container;
    this.app = null;
    this.modelContainer = null;
    this.isInitialized = false;
    this.logger = createLogger("Live2DCoreManager");

    // WebGL context loss handling state
    this._contextLost = false;
    this._contextLossCount = 0;
    this._maxContextRestoreAttempts = 3;
    this._contextRestoreTimeoutId = null;
    this._boundHandleContextLost = this._handleContextLost.bind(this);
    this._boundHandleContextRestored = this._handleContextRestored.bind(this);

    // Callbacks that external code (e.g. Live2DManager) can register
    this.onContextLost = null; // () => void
    this.onContextRestored = null; // () => void
  }

  /**
   * Initialize PIXI application and scene
   */
  async init() {
    try {
      // Wait for Live2D library to load
      await waitForLive2D();

      // Clean up existing viewer
      const existingViewer = document.getElementById("live2d-canvas");
      if (existingViewer) {
        existingViewer.remove();
      }

      // Create PIXI application
      this.app = this.createPixiApplication();

      // Set up renderer optimizations
      this.setupRenderer();

      // Set global reference
      globalThis.__PIXI_APP__ = this.app;

      // Add to container and configure canvas events
      this.app.view.setAttribute("id", "live2d-canvas");
      this.app.view.style.pointerEvents = "auto";
      this.app.view.style.touchAction = "none";
      this.app.view.style.userSelect = "none";
      this.container.appendChild(this.app.view);

      // Register WebGL context loss/restore event listeners on the canvas
      this._registerContextLossHandlers(this.app.view);

      // Create model container and set interactivity
      this.modelContainer = new window.PIXI.Container();
      this.modelContainer.interactive = true;
      this.modelContainer.interactiveChildren = true;

      // PIXI 7.x compatibility - use dynamic mode to support containsPoint detection
      if (typeof this.modelContainer.eventMode !== "undefined") {
        this.modelContainer.eventMode = "dynamic";
      }

      // Ensure stage interactivity (already set in createPixiApplication)
      if (typeof this.app.stage.eventMode !== "undefined") {
        this.app.stage.eventMode = "dynamic";
      }

      this.app.stage.addChild(this.modelContainer);

      this.isInitialized = true;
      this.logger.log("✅ Initialization complete, using PIXI event system");
    } catch (error) {
      this.logger.error("❌ Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create PIXI application instance
   */
  createPixiApplication() {
    // Dynamically determine antialias / resolution / powerPreference based on device performance
    const recommended = getRecommendedSettings();

    const app = new window.PIXI.Application({
      // Base settings
      autoDensity: true,
      resolution: recommended.resolution || window.devicePixelRatio || 1,
      width: this.container.offsetWidth,
      height: this.container.offsetHeight,

      // Performance optimization settings (dynamically adjusted based on device capabilities)
      antialias: recommended.antialias ?? true,
      powerPreference: recommended.powerPreference || "high-performance",
      backgroundAlpha: 0,
      clearBeforeRender: true,
      preserveDrawingBuffer: false,

      // WebGL settings
      forceCanvas: false,

      // Renderer settings
      sharedTicker: true,
      sharedLoader: true,
    });

    this.logger.log(
      `📊 Device performance adaptation: antialias=${recommended.antialias}, resolution=${recommended.resolution}, power=${recommended.powerPreference}`,
    );

    // PIXI 7.x compatibility: manually set interactivity
    if (app.stage) {
      // Use PIXI 7.x interaction system
      app.stage.interactive = true;
      app.stage.interactiveChildren = true;

      // If new event mode is supported, use dynamic mode
      if (typeof app.stage.eventMode !== "undefined") {
        app.stage.eventMode = "dynamic";
      }
    }

    return app;
  }

  /**
   * Set up renderer optimizations
   */
  setupRenderer() {
    if (!this.app.renderer) return;

    // Enable batching
    if (this.app.renderer.plugins?.batch) {
      this.app.renderer.plugins.batch.size = 8192;
    }

    // Set render mode
    this.app.renderer.roundPixels = true;

    // Optimize texture settings - PIXI 7.x compatibility handling
    if (this.app.renderer.texture) {
      // Check if MSAA_QUALITY is available
      if (window.PIXI.MSAA_QUALITY) {
        this.app.renderer.texture.multisample = window.PIXI.MSAA_QUALITY.HIGH;
      }
    }

    // Set ticker performance optimization
    this.app.ticker.maxFPS = 60;
    this.app.ticker.minFPS = 30;
  }

  // ─── WebGL Context Loss Handling ──────────────────────────────────

  /**
   * Register webglcontextlost / webglcontextrestored listeners on the
   * canvas element.  PIXI already has internal handling (its `ws` context
   * system calls `restoreContext()` after a loss), but we add our own
   * listeners so the *application layer* can react — e.g. pause the
   * ticker, show a UI overlay, or reload models after restoration.
   *
   * @param {HTMLCanvasElement} canvas
   * @private
   */
  _registerContextLossHandlers(canvas) {
    if (!canvas) return;
    canvas.addEventListener(
      "webglcontextlost",
      this._boundHandleContextLost,
      false,
    );
    canvas.addEventListener(
      "webglcontextrestored",
      this._boundHandleContextRestored,
      false,
    );
    this.logger.log(
      "🛡️ WebGL context loss/restore handlers registered on canvas",
    );
  }

  /**
   * Remove the context-loss listeners (called during destroy).
   * @private
   */
  _unregisterContextLossHandlers() {
    const canvas = this.app?.view;
    if (!canvas) return;
    canvas.removeEventListener(
      "webglcontextlost",
      this._boundHandleContextLost,
    );
    canvas.removeEventListener(
      "webglcontextrestored",
      this._boundHandleContextRestored,
    );

    if (this._contextRestoreTimeoutId !== null) {
      clearTimeout(this._contextRestoreTimeoutId);
      this._contextRestoreTimeoutId = null;
    }
  }

  /**
   * Handle the webglcontextlost event.
   *
   * We call `preventDefault()` to signal the browser that we *want* the
   * opportunity to restore the context.  Without this, the browser may
   * choose not to fire `webglcontextrestored` at all.
   *
   * @param {WebGLContextEvent} event
   * @private
   */
  _handleContextLost(event) {
    // Allow the context to be restored later
    event.preventDefault();

    this._contextLost = true;
    this._contextLossCount++;

    this.logger.warn(
      `⚠️ WebGL context lost (occurrence #${this._contextLossCount}). ` +
        "Rendering is paused — waiting for browser to restore the context…",
    );

    // Pause the ticker so we don't try to render with an invalid GL state
    if (this.app?.ticker) {
      this.app.ticker.stop();
    }

    // Notify external listeners
    if (typeof this.onContextLost === "function") {
      try {
        this.onContextLost();
      } catch (err) {
        this.logger.error("Error in onContextLost callback:", err);
      }
    }

    // Safety net: if the browser hasn't restored the context within 5 s,
    // try to nudge it.  PIXI's internal handler already does this, but we
    // add our own as a second chance.
    if (this._contextLossCount <= this._maxContextRestoreAttempts) {
      this._contextRestoreTimeoutId = setTimeout(() => {
        this._contextRestoreTimeoutId = null;
        if (!this._contextLost) return; // already restored

        this.logger.warn(
          "⏳ Context not yet restored after 5 s — attempting manual restore…",
        );
        try {
          const gl = this.app?.renderer?.gl;
          if (gl?.isContextLost()) {
            const ext = gl.getExtension("WEBGL_lose_context");
            if (ext) {
              ext.restoreContext();
            }
          }
        } catch (err) {
          this.logger.error("Failed to manually restore WebGL context:", err);
        }
      }, 5000);
    } else {
      this.logger.error(
        `❌ WebGL context has been lost ${this._contextLossCount} times. ` +
          "Automatic recovery disabled — the user may need to reload the page.",
      );
    }
  }

  /**
   * Handle the webglcontextrestored event.
   *
   * PIXI's internal `contextChange` runner already re-uploads textures
   * and re-creates GPU resources, so we mainly need to resume the ticker
   * and notify application code.
   *
   * @param {Event} _event
   * @private
   */
  _handleContextRestored(_event) {
    this._contextLost = false;

    // Cancel the manual-restore timeout if it hasn't fired yet
    if (this._contextRestoreTimeoutId !== null) {
      clearTimeout(this._contextRestoreTimeoutId);
      this._contextRestoreTimeoutId = null;
    }

    this.logger.log(
      `✅ WebGL context restored (after ${this._contextLossCount} loss(es)). Resuming rendering…`,
    );

    // Resume the ticker
    if (this.app?.ticker) {
      this.app.ticker.start();
    }

    // Notify external listeners
    if (typeof this.onContextRestored === "function") {
      try {
        this.onContextRestored();
      } catch (err) {
        this.logger.error("Error in onContextRestored callback:", err);
      }
    }
  }

  /**
   * Whether the WebGL context is currently in a "lost" state.
   * @returns {boolean}
   */
  get isContextLost() {
    if (this._contextLost) return true;
    // Also check the GL object directly (in case we missed an event)
    try {
      return !!this.app?.renderer?.gl?.isContextLost();
    } catch {
      return false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Update canvas dimensions
   */
  resize(width, height) {
    if (!this.app) return;

    this.app.renderer.resize(width, height);
  }

  /**
   * Optimize PIXI performance settings
   */
  optimizePerformance(options = {}) {
    if (!this.app) return;

    const {
      maxFPS = 60,
      minFPS = 30,
      enableCulling = true,
      enableBatching = true,
      textureGCMode = "auto",
    } = options;

    // Set FPS limits
    this.app.ticker.maxFPS = maxFPS;
    this.app.ticker.minFPS = minFPS;

    // Enable frustum culling
    if (enableCulling && this.modelContainer) {
      this.modelContainer.cullable = true;
    }

    // Batch processing optimization
    if (enableBatching && this.app.renderer.plugins?.batch) {
      this.app.renderer.plugins.batch.size = 8192;
    }

    // Texture garbage collection
    if (this.app.renderer.textureGC) {
      switch (textureGCMode) {
        case "aggressive":
          this.app.renderer.textureGC.maxIdle = 60 * 1;
          this.app.renderer.textureGC.checkCountMax = 60;
          break;
        case "conservative":
          this.app.renderer.textureGC.maxIdle = 60 * 10;
          this.app.renderer.textureGC.checkCountMax = 600;
          break;
        default:
          this.app.renderer.textureGC.maxIdle = 60 * 5;
          this.app.renderer.textureGC.checkCountMax = 300;
      }
    }
  }

  /**
   * Pause/resume rendering
   */
  setPaused(paused) {
    if (!this.app) return;

    if (paused) {
      this.app.ticker.stop();
      this.logger.log("⏸️ Rendering paused");
    } else {
      // Only resume if the context is not lost
      if (this.isContextLost) {
        this.logger.warn(
          "⚠️ Cannot resume rendering — WebGL context is currently lost",
        );
        return;
      }
      this.app.ticker.start();
      this.logger.log("▶️ Rendering resumed");
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (!this.app) return null;

    return {
      fps: this.app.ticker.FPS,
      deltaTime: this.app.ticker.deltaTime,
      elapsedMS: this.app.ticker.elapsedMS,
      lastTime: this.app.ticker.lastTime,
      contextLost: this._contextLost,
      contextLossCount: this._contextLossCount,
      textureMemory: this.app.renderer.textureGC
        ? {
            count: this.app.renderer.textureGC.count,
            maxIdle: this.app.renderer.textureGC.maxIdle,
            checkCountMax: this.app.renderer.textureGC.checkCountMax,
          }
        : null,
    };
  }

  /**
   * Destroy core manager
   */
  destroy() {
    this.logger.log("🧹 Starting core manager destruction");

    // Clear external callbacks so they don't fire during teardown
    this.onContextLost = null;
    this.onContextRestored = null;

    // Keep the context-loss handler active during PIXI's destroy so it
    // can intercept the webglcontextlost event (fired when PIXI releases
    // the GL context) and call preventDefault() to suppress the browser
    // console warning.  We add a temporary one-shot handler that does
    // exactly that, then unregister everything after a short delay.
    const canvas = this.app?.view;
    const suppressHandler = (e) => e.preventDefault();
    if (canvas) {
      canvas.addEventListener("webglcontextlost", suppressHandler);
    }

    // Now remove our regular context-loss listeners (the suppress handler
    // above will still catch the event)
    this._unregisterContextLossHandlers();

    // Destroy PIXI application (this triggers GL context loss internally)
    if (this.app) {
      this.app.destroy(true, true);
      this.app = null;
    }

    // Clean up the temporary suppress handler after the async
    // webglcontextlost event has had time to fire and be intercepted.
    if (canvas) {
      setTimeout(() => {
        canvas.removeEventListener("webglcontextlost", suppressHandler);
      }, 100);
    }

    // Clean up container
    if (this.container && this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    this.modelContainer = null;
    this.isInitialized = false;

    this.logger.log("🧹 Core manager destroyed");
  }
}
