/**
 * Live2D Utils - Utility Functions
 * Provides general-purpose utility functions related to Live2D
 */

const __DEV__ = import.meta.env.DEV;

export interface Logger {
  log: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export interface PerformanceSettings {
  maxFPS: number;
  minFPS: number;
  antialias: boolean;
  enableCulling: boolean;
  enableBatching: boolean;
  textureGCMode: string;
  resolution: number;
  powerPreference: string;
}

/**
 * Create a logger instance
 * @param {string} name - The name of the logger, displayed as a prefix in logs
 * @returns {Logger} A log object containing log, warn, error, debug methods
 */
export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;
  const debugMode = __DEV__;

  const _log = (message: string, level = "info", ...args: any[]) => {
    const timestamp = new Date().toISOString();
    switch (level) {
      case "error":
        console.error(`${timestamp} ${prefix} ${message}`, ...args);
        break;
      case "warn":
        console.warn(`${timestamp} ${prefix} ${message}`, ...args);
        break;
      case "debug":
        if (debugMode) {
          console.debug(`${timestamp} ${prefix} ${message}`, ...args);
        }
        break;
      default:
        console.log(`${timestamp} ${prefix} ${message}`, ...args);
    }
  };

  return {
    log: (message: string, ...args: any[]) => _log(message, "info", ...args),
    warn: (message: string, ...args: any[]) => _log(message, "warn", ...args),
    error: (message: string, ...args: any[]) => _log(message, "error", ...args),
    debug: (message: string, ...args: any[]) => _log(message, "debug", ...args),
  };
}

// Create a logger for Live2DUtils itself
const logger = createLogger("Live2DUtils");

let _loadingPromise: Promise<boolean> | null = null;

/**
 * Wait for the Live2D library to finish loading (dynamic lazy loader)
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export function waitForLive2D(timeout: number = 15000): Promise<boolean> {
  const isReady = () =>
    (window as any).PIXI &&
    (window as any).PIXI.live2d &&
    (window as any).PIXI.live2d.Live2DModel &&
    (window as any).PIXI.live2d.Cubism4ModelSettings;

  const onReady = () => {
    if ((window as any).PIXI.live2d.CubismConfig) {
      (window as any).PIXI.live2d.CubismConfig.setOpacityFromMotion = true;
    }
    logger.log("✅ Live2D library loaded successfully");
    return true;
  };

  if ((window as any).__live2dReady || isReady()) {
    onReady();
    return Promise.resolve(true);
  }

  if (_loadingPromise) {
    return _loadingPromise;
  }

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  };

  _loadingPromise = new Promise<boolean>(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Live2D library load timeout, please check the library files in the /libs/ folder"));
    }, timeout);

    try {
      logger.log("⏳ Starting dynamic loading of Live2D libraries...");
      // Load PIXI and Cubism Core in parallel
      await Promise.all([
        loadScript("libs/pixi-7.4.2.min.js"),
        loadScript("libs/live2dcubismcore.min.js"),
      ]);
      // Load Cubism4 which depends on PIXI
      await loadScript("libs/cubism4.min.js");

      clearTimeout(timeoutId);

      if (isReady()) {
        onReady();
        (window as any).__live2dReady = true;
        logger.log("✅ Live2D libraries loaded and initialized dynamically");
        resolve(true);
      } else {
        reject(new Error("Expected Live2D globals are missing after script loading"));
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      logger.error("❌ Failed to load Live2D libraries dynamically:", err.message);
      _loadingPromise = null; // Reset to allow retry
      reject(err);
    }
  });

  return _loadingPromise;
}

function suppressContextLostWarning(canvas: HTMLCanvasElement): () => void {
  const handler = (e: Event) => e.preventDefault();
  canvas.addEventListener("webglcontextlost", handler);
  return () => canvas.removeEventListener("webglcontextlost", handler);
}

export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const cleanup = suppressContextLostWarning(canvas);
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const supported = !!gl;
    if (gl) {
      const loseCtx = (gl as any).getExtension("WEBGL_lose_context");
      if (loseCtx) loseCtx.loseContext();
    }
    setTimeout(cleanup, 100);
    return supported;
  } catch (error) {
    logger.error("❌ WebGL support check failed:", error);
    return false;
  }
}

function withTemporaryGL<T>(fn: (gl: WebGLRenderingContext) => T): T | null {
  let gl: WebGLRenderingContext | null = null;
  let cleanup: (() => void) | null = null;
  try {
    const canvas = document.createElement("canvas");
    cleanup = suppressContextLostWarning(canvas);
    gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext;
    if (!gl) return null;
    return fn(gl);
  } catch (error) {
    return null;
  } finally {
    if (gl) {
      try {
        const loseCtx = gl.getExtension("WEBGL_lose_context");
        if (loseCtx) loseCtx.loseContext();
      } catch (_) {}
    }
    if (cleanup) {
      setTimeout(cleanup, 100);
    }
  }
}

function detectGPURenderer(gl: WebGLRenderingContext): string {
  try {
    const renderer = gl.getParameter(gl.RENDERER) || "";
    const isGeneric =
      !renderer ||
      /^(WebKit WebGL|Mozilla|Google Inc\.)$/i.test(renderer.trim());

    if (!isGeneric) {
      return renderer;
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
    }

    return renderer;
  } catch (_) {
    return "";
  }
}

let _cachedPerformanceLevel: "high" | "medium" | "low" | null = null;

export function getDevicePerformanceLevel(): "high" | "medium" | "low" {
  if (_cachedPerformanceLevel !== null) {
    return _cachedPerformanceLevel;
  }

  const cores = (navigator as any).hardwareConcurrency || 2;
  const memory = (navigator as any).deviceMemory || 4;

  let gpuTier = "unknown";
  const renderer = withTemporaryGL((gl) => detectGPURenderer(gl)) || "";

  if (renderer) {
    const upper = renderer.toUpperCase();
    if (
      upper.includes("GEFORCE") ||
      upper.includes("RADEON") ||
      upper.includes("INTEL ARC") ||
      upper.includes("INTEL IRIS") ||
      upper.includes("APPLE M") ||
      upper.includes("APPLE GPU")
    ) {
      gpuTier = "high";
    } else if (
      upper.includes("INTEL HD") ||
      upper.includes("INTEL UHD") ||
      upper.includes("ADRENO") ||
      upper.includes("MALI")
    ) {
      gpuTier = "medium";
    } else {
      gpuTier = "low";
    }

    logger.debug(`🖥️ GPU detected: "${renderer}" → tier=${gpuTier}`);
  } else {
    logger.debug("🖥️ GPU renderer not available, using heuristics only");
  }

  if (cores >= 8 && memory >= 8 && gpuTier === "high") {
    _cachedPerformanceLevel = "high";
  } else if (cores >= 4 && memory >= 4 && gpuTier !== "low") {
    _cachedPerformanceLevel = "medium";
  } else {
    _cachedPerformanceLevel = "low";
  }

  logger.debug(
    `🖥️ Performance level: ${_cachedPerformanceLevel} (cores=${cores}, memory=${memory}GB, gpu=${gpuTier})`
  );

  return _cachedPerformanceLevel;
}

export function getRecommendedSettings(performanceLevel: "high" | "medium" | "low" | null = null): PerformanceSettings {
  const level = performanceLevel || getDevicePerformanceLevel();

  const settings: Record<string, PerformanceSettings> = {
    high: {
      maxFPS: 60,
      minFPS: 30,
      antialias: true,
      enableCulling: true,
      enableBatching: true,
      textureGCMode: "conservative",
      resolution: Math.min(window.devicePixelRatio || 1, 2.0),
      powerPreference: "high-performance",
    },
    medium: {
      maxFPS: 45,
      minFPS: 20,
      antialias: true,
      enableCulling: true,
      enableBatching: true,
      textureGCMode: "auto",
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      powerPreference: "default",
    },
    low: {
      maxFPS: 30,
      minFPS: 15,
      antialias: false,
      enableCulling: true,
      enableBatching: true,
      textureGCMode: "aggressive",
      resolution: 1,
      powerPreference: "low-power",
    },
  };

  return settings[level] || settings.medium;
}

export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: any;
  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function generateUniqueId(prefix = "live2d"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url, window.location.origin);
    return true;
  } catch (error) {
    return false;
  }
}

export function extractFilenameFromUrl(url: string, removeExtension = true): string {
  if (!url || typeof url !== "string") return "Unknown file";

  try {
    const urlParts = url.split("/");
    let filename = urlParts[urlParts.length - 1];

    if (removeExtension) {
      filename = filename.replace(/\.(model3\.json|moc3|png|jpg|jpeg)$/i, "");
    }

    return filename || "Unknown file";
  } catch (error) {
    logger.error("❌ Failed to extract filename:", error);
    return "Unknown file";
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}
