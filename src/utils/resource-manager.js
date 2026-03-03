/**
 * 资源管理器
 * 统一管理定时器、事件监听器、音频上下文、WebGL上下文等资源
 */

export class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.timers = new Set();
    this.eventListeners = new Map();
    this.audioContexts = new Set();
    this.webglContexts = new Set();
    this.cleanupCallbacks = new Set();

    // 新增：统一的事件监听器管理
    this.globalEventListeners = new Map();
    this.modelEventListeners = new Map();

    // 新增：统一的资源清理策略
    this.cleanupStrategies = {
      timer: (timer) => clearTimeout(timer),
      interval: (interval) => clearInterval(interval),
      eventListener: (listener) => {
        if (listener.element && listener.handler) {
          listener.element.removeEventListener(
            listener.event,
            listener.handler,
          );
        }
      },
      audioContext: (context) => {
        if (context && typeof context.close === "function") {
          context.close();
        }
      },
      webglContext: (context) => {
        if (context && typeof context.getExtension === "function") {
          const loseContext = context.getExtension("WEBGL_lose_context");
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      },
      model: (model) => {
        if (model && typeof model.destroy === "function") {
          model.destroy({ children: true, texture: true, baseTexture: true });
        }
      },
    };
  }

  /**
   * 注册通用资源
   * @param {string} id - 资源ID
   * @param {*} resource - 资源实例
   * @param {Function} cleanupCallback - 清理回调
   */
  registerResource(id, resource, cleanupCallback) {
    if (this.resources.has(id)) {
      console.warn(`⚠️ [ResourceManager] 资源ID "${id}" 已存在，将覆盖旧资源`);
      this.cleanupResource(id); // 清理旧资源
    }
    this.resources.set(id, { resource, cleanupCallback });
    console.log(`📝 [ResourceManager] 注册资源: ${id}`);
  }

  /**
   * 注册定时器
   * @param {number} timer - 定时器引用
   */
  registerTimer(timer) {
    this.timers.add(timer);
  }

  /**
   * 注册事件监听器
   * @param {string} id - 监听器ID
   * @param {HTMLElement} element - 元素
   * @param {string} event - 事件类型
   * @param {Function} handler - 事件处理函数
   */
  registerEventListener(id, element, event, handler) {
    if (!this.eventListeners.has(id)) {
      this.eventListeners.set(id, []);
    }
    this.eventListeners.get(id).push({ element, event, handler });
    console.log(`📝 [ResourceManager] 注册事件监听器: ${id}`);
  }

  /**
   * 注册全局事件监听器
   * @param {string} name - 监听器名称
   * @param {string} event - 事件类型
   * @param {Function} handler - 事件处理函数
   * @param {Object} options - 事件选项
   */
  registerGlobalEventListener(name, event, handler, options = {}) {
    if (!this.globalEventListeners.has(name)) {
      this.globalEventListeners.set(name, []);
    }

    const listener = { event, handler, options };
    this.globalEventListeners.get(name).push(listener);
    window.addEventListener(event, handler, options);
    console.log(`📝 [ResourceManager] 注册全局事件监听器: ${name} (${event})`);
  }

  /**
   * 注册模型事件监听器
   * @param {string} modelId - 模型ID
   * @param {string} eventType - 事件类型
   * @param {Function} handler - 事件处理函数
   */
  registerModelEventListener(modelId, eventType, handler) {
    if (!this.modelEventListeners.has(modelId)) {
      this.modelEventListeners.set(modelId, []);
    }

    const listener = { eventType, handler };
    this.modelEventListeners.get(modelId).push(listener);
    console.log(
      `📝 [ResourceManager] 注册模型事件监听器: ${modelId} (${eventType})`,
    );
  }

  /**
   * 注册音频上下文
   * @param {string} id - 音频上下文ID
   * @param {AudioContext} context - 音频上下文
   */
  registerAudioContext(id, context) {
    this.audioContexts.add(context);
    console.log(`📝 [ResourceManager] 注册音频上下文: ${id}`);
  }

  /**
   * 注册WebGL上下文
   * @param {string} id - WebGL上下文ID
   * @param {WebGLRenderingContext} context - WebGL上下文
   */
  registerWebGLContext(id, context) {
    this.webglContexts.add(context);
    console.log(`📝 [ResourceManager] 注册WebGL上下文: ${id}`);
  }

  /**
   * 注册清理回调
   * @param {Function} callback - 清理回调函数
   */
  registerCleanupCallback(callback) {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * 清理指定资源
   * @param {string} resourceId - 资源ID
   */
  cleanupResource(resourceId) {
    const resourceInfo = this.resources.get(resourceId);
    if (resourceInfo && typeof resourceInfo.cleanupCallback === "function") {
      try {
        resourceInfo.cleanupCallback(resourceInfo.resource);
        this.resources.delete(resourceId);
        console.log(`🧹 [ResourceManager] 清理资源: ${resourceId}`);
      } catch (error) {
        console.error(
          `❌ [ResourceManager] 清理资源失败 (${resourceId}):`,
          error,
        );
      }
    } else {
      // Fallback for old system
      this.cleanupLegacyResource(resourceId);
    }
  }

  /**
   * 清理旧版资源（兼容）
   * @param {string} resourceId - 资源ID
   */
  cleanupLegacyResource(resourceId) {
    // This method is a fallback for the old system.
    // It's not fully implemented as the logic depends on the old resource management system.
    console.warn(
      `[ResourceManager] cleanupLegacyResource called for: ${resourceId}. This is a fallback and may not clean up resources correctly.`,
    );
  }

  /**
   * 清理所有定时器
   */
  cleanupTimers() {
    let cleanedCount = 0;
    this.timers.forEach((timer) => {
      this.cleanupStrategies.timer(timer);
      cleanedCount++;
    });
    this.timers.clear();
    console.log(`🧹 [ResourceManager] 清理定时器: ${cleanedCount} 个`);
  }

  /**
   * 清理所有事件监听器
   */
  cleanupEventListeners() {
    let cleanedCount = 0;
    this.eventListeners.forEach((listeners, key) => {
      listeners.forEach(({ element, event, handler }) => {
        try {
          if (element && typeof element.removeEventListener === "function") {
            element.removeEventListener(event, handler);
          }
        } catch (e) {
          console.warn(
            `⚠️ [ResourceManager] 清理事件监听器失败 (${key}/${event}):`,
            e,
          );
        }
        cleanedCount++;
      });
    });
    this.eventListeners.clear();
    console.log(`🧹 [ResourceManager] 清理事件监听器: ${cleanedCount} 个`);
  }

  /**
   * 清理所有全局事件监听器
   */
  cleanupGlobalEventListeners() {
    let cleanedCount = 0;
    this.globalEventListeners.forEach((listeners, name) => {
      listeners.forEach((listener) => {
        // Global listeners are registered on `window`, not on an `element`.
        // The generic eventListener strategy expects { element, event, handler }
        // so we call window.removeEventListener directly.
        try {
          window.removeEventListener(
            listener.event,
            listener.handler,
            listener.options,
          );
        } catch (e) {
          console.warn(
            `⚠️ [ResourceManager] 清理全局事件监听器失败 (${name}/${listener.event}):`,
            e,
          );
        }
        cleanedCount++;
      });
    });
    this.globalEventListeners.clear();
    console.log(`🧹 [ResourceManager] 清理全局事件监听器: ${cleanedCount} 个`);
  }

  /**
   * 清理所有模型事件监听器
   */
  cleanupModelEventListeners() {
    let cleanedCount = 0;
    this.modelEventListeners.forEach((listeners, modelId) => {
      listeners.forEach((listener) => {
        console.log(
          `🧹 [ResourceManager] 清理模型事件监听器: ${modelId} (${listener.eventType})`,
        );
        cleanedCount++;
      });
    });
    this.modelEventListeners.clear();
    console.log(`🧹 [ResourceManager] 清理模型事件监听器: ${cleanedCount} 个`);
  }

  /**
   * 清理所有音频上下文
   */
  cleanupAudioContexts() {
    let cleanedCount = 0;
    this.audioContexts.forEach((context) => {
      this.cleanupStrategies.audioContext(context);
      cleanedCount++;
    });
    this.audioContexts.clear();
    console.log(`🧹 [ResourceManager] 清理音频上下文: ${cleanedCount} 个`);
  }

  /**
   * 清理所有WebGL上下文
   */
  cleanupWebGLContexts() {
    let cleanedCount = 0;
    this.webglContexts.forEach((context) => {
      this.cleanupStrategies.webglContext(context);
      cleanedCount++;
    });
    this.webglContexts.clear();
    console.log(`🧹 [ResourceManager] 清理 WebGL 上下文: ${cleanedCount} 个`);
  }

  /**
   * 执行所有清理回调
   */
  executeCleanupCallbacks() {
    let executedCount = 0;
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
        executedCount++;
      } catch (error) {
        console.error("❌ [ResourceManager] 执行清理回调失败:", error);
      }
    });
    this.cleanupCallbacks.clear();
    console.log(`🧹 [ResourceManager] 执行清理回调: ${executedCount} 个`);
  }

  /**
   * 清理所有资源
   */
  cleanupAll() {
    console.log("🧹 [ResourceManager] 开始清理所有资源...");

    // 执行清理回调
    this.executeCleanupCallbacks();

    // 清理定时器
    this.cleanupTimers();

    // 清理事件监听器
    this.cleanupEventListeners();

    // 清理全局事件监听器
    this.cleanupGlobalEventListeners();

    // 清理模型事件监听器
    this.cleanupModelEventListeners();

    // 清理音频上下文
    this.cleanupAudioContexts();

    // 清理WebGL上下文
    this.cleanupWebGLContexts();

    // 清理其他资源
    this.resources.forEach((value, key) => {
      this.cleanupResource(key);
    });

    const resourceCount = this.getResourceCount();
    console.log(
      `🧹 [ResourceManager] 所有资源已清理完成 (资源: ${resourceCount} 个)`,
    );
  }

  /**
   * 获取资源统计信息
   */
  getResourceCount() {
    return {
      timers: this.timers.size,
      eventListeners: Array.from(this.eventListeners.values()).reduce(
        (sum, listeners) => sum + listeners.length,
        0,
      ),
      globalEventListeners: Array.from(
        this.globalEventListeners.values(),
      ).reduce((sum, listeners) => sum + listeners.length, 0),
      modelEventListeners: Array.from(this.modelEventListeners.values()).reduce(
        (sum, listeners) => sum + listeners.length,
        0,
      ),
      audioContexts: this.audioContexts.size,
      webglContexts: this.webglContexts.size,
      cleanupCallbacks: this.cleanupCallbacks.size,
      resources: this.resources.size,
    };
  }

  /**
   * 向后兼容的获取统计信息方法
   * @deprecated 使用 getResourceCount() 替代
   */
  getStats() {
    console.warn("⚠️ [ResourceManager] getStats已废弃，请使用getResourceCount");
    return this.getResourceCount();
  }

  /**
   * 检查是否有未清理的资源
   */
  hasUncleanedResources() {
    const counts = this.getResourceCount();
    return Object.values(counts).some((count) => count > 0);
  }
}

// 创建全局资源管理器实例
export const globalResourceManager = new ResourceManager();

// 页面卸载时自动清理所有资源
window.addEventListener("beforeunload", () => {
  globalResourceManager.cleanupAll();
});
