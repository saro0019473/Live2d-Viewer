/**
 * Resource Manager
 * Centralized management of timers, event listeners, audio contexts, WebGL contexts, and other resources
 */

const __DEV__ = import.meta.env.DEV;

export class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.timers = new Set();
    this.eventListeners = new Map();
    this.audioContexts = new Set();
    this.webglContexts = new Set();
    this.cleanupCallbacks = new Set();

    // Unified event listener management
    this.globalEventListeners = new Map();
    this.modelEventListeners = new Map();

    // Unified resource cleanup strategies
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
   * Register a generic resource
   * @param {string} id - Resource ID
   * @param {*} resource - Resource instance
   * @param {Function} cleanupCallback - Cleanup callback
   */
  registerResource(id, resource, cleanupCallback) {
    if (this.resources.has(id)) {
      console.warn(
        `⚠️ [ResourceManager] Resource ID "${id}" already exists, overwriting old resource`,
      );
      this.cleanupResource(id); // Clean up old resource
    }
    this.resources.set(id, { resource, cleanupCallback });
    __DEV__ && console.log(`📝 [ResourceManager] Registered resource: ${id}`);
  }

  /**
   * Register a timer
   * @param {number} timer - Timer reference
   */
  registerTimer(timer) {
    this.timers.add(timer);
  }

  /**
   * Register an event listener
   * @param {string} id - Listener ID
   * @param {HTMLElement} element - Element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   */
  registerEventListener(id, element, event, handler) {
    if (!this.eventListeners.has(id)) {
      this.eventListeners.set(id, []);
    }
    this.eventListeners.get(id).push({ element, event, handler });
    __DEV__ &&
      console.log(`📝 [ResourceManager] Registered event listener: ${id}`);
  }

  /**
   * Register a global event listener
   * @param {string} name - Listener name
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {Object} options - Event options
   */
  registerGlobalEventListener(name, event, handler, options = {}) {
    if (!this.globalEventListeners.has(name)) {
      this.globalEventListeners.set(name, []);
    }

    const listener = { event, handler, options };
    this.globalEventListeners.get(name).push(listener);
    window.addEventListener(event, handler, options);
    __DEV__ &&
      console.log(
        `📝 [ResourceManager] Registered global event listener: ${name} (${event})`,
      );
  }

  /**
   * Register a model event listener
   * @param {string} modelId - Model ID
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler function
   */
  registerModelEventListener(modelId, eventType, handler) {
    if (!this.modelEventListeners.has(modelId)) {
      this.modelEventListeners.set(modelId, []);
    }

    const listener = { eventType, handler };
    this.modelEventListeners.get(modelId).push(listener);
    __DEV__ &&
      console.log(
        `📝 [ResourceManager] Registered model event listener: ${modelId} (${eventType})`,
      );
  }

  /**
   * Register an audio context
   * @param {string} id - Audio context ID
   * @param {AudioContext} context - Audio context
   */
  registerAudioContext(id, context) {
    this.audioContexts.add(context);
    __DEV__ &&
      console.log(`📝 [ResourceManager] Registered audio context: ${id}`);
  }

  /**
   * Register a WebGL context
   * @param {string} id - WebGL context ID
   * @param {WebGLRenderingContext} context - WebGL context
   */
  registerWebGLContext(id, context) {
    this.webglContexts.add(context);
    __DEV__ &&
      console.log(`📝 [ResourceManager] Registered WebGL context: ${id}`);
  }

  /**
   * Register a cleanup callback
   * @param {Function} callback - Cleanup callback function
   */
  registerCleanupCallback(callback) {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Clean up a specific resource
   * @param {string} resourceId - Resource ID
   * @param {string} [subId] - Optional sub-identifier (e.g. modelId for model event listeners)
   */
  cleanupResource(resourceId, subId) {
    // Route known resource types to their dedicated cleanup methods
    if (resourceId === "modelEventListener" && subId) {
      this.cleanupModelEventListenersByModelId(subId);
      return;
    }

    if (resourceId === "globalEventListener" && subId) {
      // Clean up a specific global event listener group by name
      const listeners = this.globalEventListeners.get(subId);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            window.removeEventListener(
              listener.event,
              listener.handler,
              listener.options,
            );
          } catch (e) {
            console.warn(
              `⚠️ [ResourceManager] Failed to clean up global event listener (${subId}/${listener.event}):`,
              e,
            );
          }
        });
        this.globalEventListeners.delete(subId);
        __DEV__ &&
          console.log(
            `🧹 [ResourceManager] Cleaned up global event listener group: ${subId}`,
          );
      }
      return;
    }

    const resourceInfo = this.resources.get(resourceId);
    if (resourceInfo && typeof resourceInfo.cleanupCallback === "function") {
      try {
        resourceInfo.cleanupCallback(resourceInfo.resource);
        this.resources.delete(resourceId);
        __DEV__ &&
          console.log(
            `🧹 [ResourceManager] Cleaned up resource: ${resourceId}`,
          );
      } catch (error) {
        console.error(
          `❌ [ResourceManager] Failed to clean up resource (${resourceId}):`,
          error,
        );
      }
    } else {
      // Fallback for old system
      this.cleanupLegacyResource(resourceId);
    }
  }

  /**
   * Clean up legacy resource (backward compatibility)
   * @param {string} resourceId - Resource ID
   */
  cleanupLegacyResource(resourceId) {
    // This method is a fallback for the old system.
    // It's not fully implemented as the logic depends on the old resource management system.
    console.warn(
      `[ResourceManager] cleanupLegacyResource called for: ${resourceId}. This is a fallback and may not clean up resources correctly.`,
    );
  }

  /**
   * Clean up all timers
   */
  cleanupTimers() {
    let cleanedCount = 0;
    this.timers.forEach((timer) => {
      this.cleanupStrategies.timer(timer);
      cleanedCount++;
    });
    this.timers.clear();
    __DEV__ &&
      console.log(`🧹 [ResourceManager] Cleaned up timers: ${cleanedCount}`);
  }

  /**
   * Clean up all event listeners
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
            `⚠️ [ResourceManager] Failed to clean up event listener (${key}/${event}):`,
            e,
          );
        }
        cleanedCount++;
      });
    });
    this.eventListeners.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up event listeners: ${cleanedCount}`,
      );
  }

  /**
   * Clean up all global event listeners
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
            `⚠️ [ResourceManager] Failed to clean up global event listener (${name}/${listener.event}):`,
            e,
          );
        }
        cleanedCount++;
      });
    });
    this.globalEventListeners.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up global event listeners: ${cleanedCount}`,
      );
  }

  /**
   * Clean up model event listeners for a specific model
   * @param {string} modelId - Model ID to clean up
   * @returns {number} Number of listeners cleaned up
   */
  cleanupModelEventListenersByModelId(modelId) {
    if (!modelId || !this.modelEventListeners.has(modelId)) {
      return 0;
    }

    let cleanedCount = 0;
    const listeners = this.modelEventListeners.get(modelId);
    if (listeners) {
      listeners.forEach((listener) => {
        __DEV__ &&
          console.log(
            `🧹 [ResourceManager] Cleaned up model event listener: ${modelId} (${listener.eventType})`,
          );
        cleanedCount++;
      });
    }
    this.modelEventListeners.delete(modelId);
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up model event listeners for ${modelId}: ${cleanedCount}`,
      );
    return cleanedCount;
  }

  /**
   * Clean up all model event listeners
   */
  cleanupModelEventListeners() {
    let cleanedCount = 0;
    this.modelEventListeners.forEach((listeners, modelId) => {
      listeners.forEach((listener) => {
        __DEV__ &&
          console.log(
            `🧹 [ResourceManager] Cleaned up model event listener: ${modelId} (${listener.eventType})`,
          );
        cleanedCount++;
      });
    });
    this.modelEventListeners.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up model event listeners: ${cleanedCount}`,
      );
  }

  /**
   * Clean up all audio contexts
   */
  cleanupAudioContexts() {
    let cleanedCount = 0;
    this.audioContexts.forEach((context) => {
      this.cleanupStrategies.audioContext(context);
      cleanedCount++;
    });
    this.audioContexts.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up audio contexts: ${cleanedCount}`,
      );
  }

  /**
   * Clean up all WebGL contexts
   */
  cleanupWebGLContexts() {
    let cleanedCount = 0;
    this.webglContexts.forEach((context) => {
      this.cleanupStrategies.webglContext(context);
      cleanedCount++;
    });
    this.webglContexts.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up WebGL contexts: ${cleanedCount}`,
      );
  }

  /**
   * Execute all cleanup callbacks
   */
  executeCleanupCallbacks() {
    let executedCount = 0;
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
        executedCount++;
      } catch (error) {
        console.error(
          "❌ [ResourceManager] Failed to execute cleanup callback:",
          error,
        );
      }
    });
    this.cleanupCallbacks.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Executed cleanup callbacks: ${executedCount}`,
      );
  }

  /**
   * Clean up all resources
   */
  cleanupAll() {
    __DEV__ &&
      console.log("🧹 [ResourceManager] Starting cleanup of all resources...");

    // Execute cleanup callbacks
    this.executeCleanupCallbacks();

    // Clean up timers
    this.cleanupTimers();

    // Clean up event listeners
    this.cleanupEventListeners();

    // Clean up global event listeners
    this.cleanupGlobalEventListeners();

    // Clean up model event listeners
    this.cleanupModelEventListeners();

    // Clean up audio contexts
    this.cleanupAudioContexts();

    // Clean up WebGL contexts
    this.cleanupWebGLContexts();

    // Clean up other resources
    this.resources.forEach((value, key) => {
      this.cleanupResource(key);
    });

    const resourceCount = this.getResourceCount();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] All resources cleaned up (resources: ${resourceCount})`,
      );
  }

  /**
   * Get resource statistics
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
   * Backward-compatible method for getting statistics
   * @deprecated Use getResourceCount() instead
   */
  getStats() {
    console.warn(
      "⚠️ [ResourceManager] getStats is deprecated, use getResourceCount instead",
    );
    return this.getResourceCount();
  }

  /**
   * Check if there are uncleaned resources
   */
  hasUncleanedResources() {
    const counts = this.getResourceCount();
    return Object.values(counts).some((count) => count > 0);
  }
}

// Create global resource manager instance
export const globalResourceManager = new ResourceManager();

// Automatically clean up all resources when the page unloads
window.addEventListener("beforeunload", () => {
  globalResourceManager.cleanupAll();
});
