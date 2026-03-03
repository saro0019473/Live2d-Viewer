/**
 * Live2D Utils - 工具函数
 * 提供Live2D相关的通用工具函数
 */

/**
 * 创建一个日志记录器实例
 * @param {string} name - 日志器的名称，将作为前缀显示在日志中
 * @returns {Object} 包含log, warn, error, debug方法的日志对象
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

// 为 Live2DUtils 自身创建一个日志器
const logger = createLogger("Live2DUtils");

/**
 * 等待 Live2D 库加载完成
 * @param {number} timeout - 超时时间（毫秒）
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
      logger.log("✅ Live2D 库加载完成");
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
          "Live2D 库加载超时，请检查 /libs/ 文件夹中的库文件",
        );
        logger.error("❌", error.message);
        reject(error);
      }
    }, timeout);
  });
}

/**
 * 检查浏览器是否支持 WebGL
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
    logger.error("❌ WebGL 支持检查失败:", error);
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
 * 获取设备性能等级
 * @returns {string} 'high' | 'medium' | 'low'
 */
export function getDevicePerformanceLevel() {
  if (_cachedPerformanceLevel !== null) {
    return _cachedPerformanceLevel;
  }

  // 检查硬件并发数
  const cores = navigator.hardwareConcurrency || 2;

  // 检查内存（如果可用）
  const memory = navigator.deviceMemory || 4;

  // 检查GPU信息（如果可用）
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

  // 综合判断性能等级
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
 * 获取推荐的性能设置
 * @param {string} performanceLevel - 性能等级
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
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间
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
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间
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
 * 生成唯一ID
 * @param {string} prefix - 前缀
 * @returns {string}
 */
export function generateUniqueId(prefix = "live2d") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 深度克隆对象
 * @param {any} obj - 要克隆的对象
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
 * 检查URL是否有效
 * @param {string} url - 要检查的URL
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
 * 从URL中提取文件名
 * @param {string} url - URL字符串
 * @param {boolean} removeExtension - 是否移除扩展名
 * @returns {string}
 */
export function extractFilenameFromUrl(url, removeExtension = true) {
  if (!url || typeof url !== "string") return "未知文件";

  try {
    const urlParts = url.split("/");
    let filename = urlParts[urlParts.length - 1];

    if (removeExtension) {
      filename = filename.replace(/\.(model3\.json|moc3|png|jpg|jpeg)$/i, "");
    }

    return filename || "未知文件";
  } catch (error) {
    logger.error("❌ 提取文件名失败:", error);
    return "未知文件";
  }
}

/**
 * 计算两点之间的距离
 * @param {Object} point1 - 点1 {x, y}
 * @param {Object} point2 - 点2 {x, y}
 * @returns {number}
 */
export function calculateDistance(point1, point2) {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 限制数值在指定范围内
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 线性插值
 * @param {number} start - 起始值
 * @param {number} end - 结束值
 * @param {number} t - 插值参数 (0-1)
 * @returns {number}
 */
export function lerp(start, end, t) {
  return start + (end - start) * clamp(t, 0, 1);
}

/**
 * 获取随机数组元素
 * @param {Array} array - 数组
 * @returns {any}
 */
export function getRandomArrayElement(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}
