/**
 * Live2D Utils - Utility Functions
 * Provides general-purpose utility functions related to Live2D
 */

/**
 * Create a logger instance
 * @param {string} name - The name of the logger, displayed as a prefix in logs
 * @returns {Object} A log object containing log, warn, error, debug methods
 */
export function createLogger(name) {
  const prefix = `[${name}]`;
  const debugMode = process.env.NODE_ENV === "development";

  const _log = (message, level = "info", ...args) => {
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
    log: (message, ...args) => _log(message, "info", ...args),
    warn: (message, ...args) => _log(message, "warn", ...args),
    error: (message, ...args) => _log(message, "error", ...args),
    debug: (message, ...args) => _log(message, "debug", ...args),
  };
}

// Create a logger for Live2DUtils itself
const logger = createLogger("Live2DUtils");

/**
 * Wait for the Live2D library to finish loading
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export function waitForLive2D(timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Helper: check if all expected globals are present
    const isReady = () =>
      window.PIXI &&
      window.PIXI.live2d &&
      window.PIXI.live2d.Live2DModel &&
      window.PIXI.live2d.Cubism4ModelSettings;

    // Helper: one-time configuration after libraries are confirmed ready
    const onReady = () => {
      if (window.PIXI.live2d.CubismConfig) {
        window.PIXI.live2d.CubismConfig.setOpacityFromMotion = true;
      }
      logger.log("✅ Live2D library loaded successfully");
      resolve(true);
    };

    // 1. Already loaded (e.g. cached / instant scripts)
    if (window.__live2dReady || isReady()) {
      onReady();
      return;
    }

    let settled = false;

    // 2. Listen for the event dispatched by index.html
    const onEvent = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      onReady();
    };
    window.addEventListener("live2d-ready", onEvent, { once: true });

    // 3. Timeout guard
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener("live2d-ready", onEvent);

      // Last-chance check — the event may have been missed
      if (isReady()) {
        onReady();
      } else {
        const error = new Error(
          "Live2D library load timeout, please check the library files in the /libs/ folder",
        );
        logger.error("❌", error.message);
        reject(error);
      }
    }, timeout);
  });
}

/**
 * Check if the browser supports WebGL
 * @returns {boolean}
 */
export function checkWebGLSupport() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const supported = !!gl;
    // Properly release the temporary context so the browser does not
    // fire a "WebGL context was lost" warning when GC collects it.
    if (gl) {
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      if (loseCtx) loseCtx.loseContext();
    }
    return supported;
  } catch (error) {
    logger.error("❌ WebGL support check failed:", error);
    return false;
  }
}

/**
 * Safely create a temporary WebGL context, run a callback with it,
 * then release the context so the browser doesn't warn about a lost
 * context when the canvas is garbage-collected.
 *
 * @param {Function} fn - receives the WebGLRenderingContext, returns any value
 * @returns {*} whatever `fn` returned, or `null` on failure
 */
function withTemporaryGL(fn) {
  let gl = null;
  try {
    const canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;
    return fn(gl);
  } catch (error) {
    return null;
  } finally {
    // Always release the context to prevent "WebGL context was lost"
    if (gl) {
      try {
        const loseCtx = gl.getExtension("WEBGL_lose_context");
        if (loseCtx) loseCtx.loseContext();
      } catch (_) {
        // ignore – best effort cleanup
      }
    }
  }
}

/**
 * Detect GPU renderer string without using the deprecated
 * WEBGL_debug_renderer_info extension (removed in Firefox 128+).
 *
 * Strategy:
 *  1. Try the standard `gl.getParameter(gl.RENDERER)` which modern
 *     browsers now expose with useful strings.
 *  2. Fall back to WEBGL_debug_renderer_info only if step 1 yields a
 *     generic/useless string (e.g. "WebKit WebGL").
 *
 * @param {WebGLRenderingContext} gl
 * @returns {string} renderer string, or empty string on failure
 */
function detectGPURenderer(gl) {
  try {
    // Modern browsers (Chrome 113+, Firefox 128+) return a meaningful
    // string from the plain RENDERER parameter.
    const renderer = gl.getParameter(gl.RENDERER) || "";

    // Some browsers still return a generic wrapper name for the plain
    // parameter.  In that case, fall back to the debug extension which
    // older browsers still support.
    const isGeneric =
      !renderer ||
      /^(WebKit WebGL|Mozilla|Google Inc\.)$/i.test(renderer.trim());

    if (!isGeneric) {
      return renderer;
    }

    // Fallback: use the deprecated extension (still works in Chrome,
    // and in Firefox < 128). Wrapped in try/catch so it never throws.
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
    }

    return renderer;
  } catch (_) {
    return "";
  }
}

// Cache the result so the (potentially expensive) GL probe only runs once.
let _cachedPerformanceLevel = null;

/**
 * Get the device performance level
 * @returns {string} 'high' | 'medium' | 'low'
 */
export function getDevicePerformanceLevel() {
  if (_cachedPerformanceLevel !== null) {
    return _cachedPerformanceLevel;
  }

  // Check hardware concurrency
  const cores = navigator.hardwareConcurrency || 2;

  // Check memory (if available)
  const memory = navigator.deviceMemory || 4;

  // Check GPU info (if available)
  let gpuTier = "unknown";
  const renderer = withTemporaryGL((gl) => detectGPURenderer(gl)) || "";

  if (renderer) {
    const upper = renderer.toUpperCase();
    // High-end discrete GPUs
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

  // Determine overall performance level
  if (cores >= 8 && memory >= 8 && gpuTier === "high") {
    _cachedPerformanceLevel = "high";
  } else if (cores >= 4 && memory >= 4 && gpuTier !== "low") {
    _cachedPerformanceLevel = "medium";
  } else {
    _cachedPerformanceLevel = "low";
  }

  logger.debug(
    `🖥️ Performance level: ${_cachedPerformanceLevel} (cores=${cores}, memory=${memory}GB, gpu=${gpuTier})`,
  );

  return _cachedPerformanceLevel;
}

/**
 * Get recommended performance settings
 * @param {string} performanceLevel - Performance level
 * @returns {Object}
 */
export function getRecommendedSettings(performanceLevel = null) {
  const level = performanceLevel || getDevicePerformanceLevel();

  const settings = {
    high: {
      maxFPS: 60,
      minFPS: 30,
      antialias: true,
      enableCulling: true,
      enableBatching: true,
      textureGCMode: "conservative",
      resolution: window.devicePixelRatio || 1,
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

/**
 * Debounce function
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - The function to throttle
 * @param {number} limit - Limit time
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate a unique ID
 * @param {string} prefix - Prefix
 * @returns {string}
 */
export function generateUniqueId(prefix = "live2d") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Deep clone an object
 * @param {any} obj - The object to clone
 * @returns {any}
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  if (typeof obj === "object") {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * Check if a URL is valid
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export function isValidUrl(url) {
  try {
    new URL(url, window.location.origin);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Extract filename from a URL
 * @param {string} url - URL string
 * @param {boolean} removeExtension - Whether to remove the extension
 * @returns {string}
 */
export function extractFilenameFromUrl(url, removeExtension = true) {
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

/**
 * Calculate the distance between two points
 * @param {Object} point1 - Point 1 {x, y}
 * @param {Object} point2 - Point 2 {x, y}
 * @returns {number}
 */
export function calculateDistance(point1, point2) {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clamp a value within a specified range
 * @param {number} value - The value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Interpolation parameter (0-1)
 * @returns {number}
 */
export function lerp(start, end, t) {
  return start + (end - start) * clamp(t, 0, 1);
}

/**
 * Get a random array element
 * @param {Array} array - The array
 * @returns {any}
 */
export function getRandomArrayElement(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}
