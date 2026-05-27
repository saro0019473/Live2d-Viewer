/**
 * ResourceManager \u2014 Global Resource Tracker & Cleanup
 *
 * `globalResourceManager` (exported singleton) tracks every resource that
 * needs explicit cleanup: timers, event listeners, audio contexts, WebGL
 * contexts, and custom disposables.
 *
 * Usage patterns:
 *
 * 1. Event listeners (auto-removed on destroyAll):
 *    globalResourceManager.addGlobalEventListener('resize', handler)
 *    globalResourceManager.addEventListenerForElement(el, 'click', handler)
 *
 * 2. Timers:
 *    const id = globalResourceManager.addTimer(setTimeout(fn, 1000))
 *
 * 3. Custom disposables:
 *    globalResourceManager.register('myThing', resource, (r) => r.dispose())
 *
 * 4. Model-specific event listeners:
 *    globalResourceManager.addModelEventListener(modelId, 'hit', handler)
 *    // auto-removed when globalResourceManager.removeModelListeners(modelId) is called
 *
 * Cleanup:
 *    globalResourceManager.destroyAll()  \u2014 call on full app teardown
 *    globalResourceManager.removeModelListeners(id) \u2014 call when a model unloads
 * See: docs/architecture.md
 */

const __DEV__ = import.meta.env.DEV;

export interface RegisteredResource {
  resource: any;
  cleanupCallback: (res: any) => void;
}

export interface EventListenerRegistration {
  element: HTMLElement | Window | Document | MediaQueryList;
  event: string;
  handler: EventListenerOrEventListenerObject;
}

export interface GlobalEventListenerRegistration {
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

export interface ModelEventListenerRegistration {
  eventType: string;
  handler: (...args: any[]) => void;
}

export interface ResourceCount {
  timers: number;
  eventListeners: number;
  globalEventListeners: number;
  modelEventListeners: number;
  audioContexts: number;
  webglContexts: number;
  cleanupCallbacks: number;
  resources: number;
}

export class ResourceManager {
  private resources = new Map<string, RegisteredResource>();
  private timers = new Set<any>();
  private eventListeners = new Map<string, EventListenerRegistration[]>();
  private audioContexts = new Set<AudioContext>();
  private webglContexts = new Set<WebGLRenderingContext | WebGL2RenderingContext>();
  private cleanupCallbacks = new Set<() => void>();

  // Unified event listener management
  private globalEventListeners = new Map<string, GlobalEventListenerRegistration[]>();
  private modelEventListeners = new Map<string, ModelEventListenerRegistration[]>();

  // Unified resource cleanup strategies
  private cleanupStrategies: Record<string, (arg: any) => void> = {
    timer: (timer: any) => clearTimeout(timer),
    interval: (interval: any) => clearInterval(interval),
    eventListener: (listener: EventListenerRegistration) => {
      if (listener.element && listener.handler) {
        listener.element.removeEventListener(
          listener.event,
          listener.handler
        );
      }
    },
    audioContext: (context: AudioContext) => {
      if (context && typeof context.close === "function") {
        context.close();
      }
    },
    webglContext: (context: WebGLRenderingContext | WebGL2RenderingContext) => {
      if (context && typeof context.getExtension === "function") {
        const loseContext = context.getExtension("WEBGL_lose_context");
        if (loseContext) {
          (loseContext as any).loseContext();
        }
      }
    },
    model: (model: any) => {
      if (model && typeof model.destroy === "function") {
        model.destroy({ children: true, texture: true, baseTexture: true });
      }
    },
  };

  registerResource(id: string, resource: any, cleanupCallback: (res: any) => void): void {
    if (this.resources.has(id)) {
      console.warn(
        `⚠️ [ResourceManager] Resource ID "${id}" already exists, overwriting old resource`
      );
      this.cleanupResource(id); // Clean up old resource
    }
    this.resources.set(id, { resource, cleanupCallback });
    __DEV__ && console.log(`📝 [ResourceManager] Registered resource: ${id}`);
  }

  registerTimer(timer: any): void {
    this.timers.add(timer);
  }

  registerEventListener(id: string, element: HTMLElement | Window | Document | MediaQueryList, event: string, handler: EventListenerOrEventListenerObject): void {
    if (!this.eventListeners.has(id)) {
      this.eventListeners.set(id, []);
    }
    this.eventListeners.get(id)!.push({ element, event, handler });
    __DEV__ &&
      console.log(`📝 [ResourceManager] Registered event listener: ${id}`);
  }

  registerGlobalEventListener(name: string, event: string, handler: EventListenerOrEventListenerObject, options: boolean | AddEventListenerOptions = {}): void {
    if (!this.globalEventListeners.has(name)) {
      this.globalEventListeners.set(name, []);
    }

    const listener: GlobalEventListenerRegistration = { event, handler, options };
    this.globalEventListeners.get(name)!.push(listener);
    window.addEventListener(event, handler, options);
    __DEV__ &&
      console.log(
        `📝 [ResourceManager] Registered global event listener: ${name} (${event})`
      );
  }

  registerModelEventListener(modelId: string, eventType: string, handler: (...args: any[]) => void): void {
    if (!this.modelEventListeners.has(modelId)) {
      this.modelEventListeners.set(modelId, []);
    }

    const listener: ModelEventListenerRegistration = { eventType, handler };
    this.modelEventListeners.get(modelId)!.push(listener);
    __DEV__ &&
      console.log(
        `📝 [ResourceManager] Registered model event listener: ${modelId} (${eventType})`
      );
  }

  registerAudioContext(id: string, context: AudioContext): void {
    this.audioContexts.add(context);
    __DEV__ &&
      console.log(`📝 [ResourceManager] Registered audio context: ${id}`);
  }

  registerWebGLContext(id: string, context: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.webglContexts.add(context);
    __DEV__ &&
      console.log(`📝 [ResourceManager] Registered WebGL context: ${id}`);
  }

  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  cleanupResource(resourceId: string, subId?: string): void {
    if (resourceId === "modelEventListener" && subId) {
      this.cleanupModelEventListenersByModelId(subId);
      return;
    }

    if (resourceId === "globalEventListener" && subId) {
      const listeners = this.globalEventListeners.get(subId);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            window.removeEventListener(
              listener.event,
              listener.handler,
              listener.options
            );
          } catch (e) {
            console.warn(
              `⚠️ [ResourceManager] Failed to clean up global event listener (${subId}/${listener.event}):`,
              e
            );
          }
        });
        this.globalEventListeners.delete(subId);
        __DEV__ &&
          console.log(
            `🧹 [ResourceManager] Cleaned up global event listener group: ${subId}`
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
            `🧹 [ResourceManager] Cleaned up resource: ${resourceId}`
          );
      } catch (error) {
        console.error(
          `❌ [ResourceManager] Failed to clean up resource (${resourceId}):`,
          error
        );
      }
    } else {
      this.cleanupLegacyResource(resourceId);
    }
  }

  cleanupLegacyResource(resourceId: string): void {
    console.warn(
      `[ResourceManager] cleanupLegacyResource called for: ${resourceId}. This is a fallback and may not clean up resources correctly.`
    );
  }

  cleanupTimers(): void {
    let cleanedCount = 0;
    this.timers.forEach((timer) => {
      this.cleanupStrategies.timer(timer);
      cleanedCount++;
    });
    this.timers.clear();
    __DEV__ &&
      console.log(`🧹 [ResourceManager] Cleaned up timers: ${cleanedCount}`);
  }

  cleanupEventListeners(): void {
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
            e
          );
        }
        cleanedCount++;
      });
    });
    this.eventListeners.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up event listeners: ${cleanedCount}`
      );
  }

  cleanupGlobalEventListeners(): void {
    let cleanedCount = 0;
    this.globalEventListeners.forEach((listeners, name) => {
      listeners.forEach((listener) => {
        try {
          window.removeEventListener(
            listener.event,
            listener.handler,
            listener.options
          );
        } catch (e) {
          console.warn(
            `⚠️ [ResourceManager] Failed to clean up global event listener (${name}/${listener.event}):`,
            e
          );
        }
        cleanedCount++;
      });
    });
    this.globalEventListeners.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up global event listeners: ${cleanedCount}`
      );
  }

  cleanupModelEventListenersByModelId(modelId: string): number {
    if (!modelId || !this.modelEventListeners.has(modelId)) {
      return 0;
    }

    let cleanedCount = 0;
    const listeners = this.modelEventListeners.get(modelId);
    if (listeners) {
      listeners.forEach((listener) => {
        __DEV__ &&
          console.log(
            `🧹 [ResourceManager] Cleaned up model event listener: ${modelId} (${listener.eventType})`
          );
        cleanedCount++;
      });
    }
    this.modelEventListeners.delete(modelId);
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up model event listeners for ${modelId}: ${cleanedCount}`
      );
    return cleanedCount;
  }

  cleanupModelEventListeners(): void {
    let cleanedCount = 0;
    this.modelEventListeners.forEach((listeners, modelId) => {
      listeners.forEach((listener) => {
        __DEV__ &&
          console.log(
            `🧹 [ResourceManager] Cleaned up model event listener: ${modelId} (${listener.eventType})`
          );
        cleanedCount++;
      });
    });
    this.modelEventListeners.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up model event listeners: ${cleanedCount}`
      );
  }

  cleanupAudioContexts(): void {
    let cleanedCount = 0;
    this.audioContexts.forEach((context) => {
      this.cleanupStrategies.audioContext(context);
      cleanedCount++;
    });
    this.audioContexts.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up audio contexts: ${cleanedCount}`
      );
  }

  cleanupWebGLContexts(): void {
    let cleanedCount = 0;
    this.webglContexts.forEach((context) => {
      this.cleanupStrategies.webglContext(context);
      cleanedCount++;
    });
    this.webglContexts.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Cleaned up WebGL contexts: ${cleanedCount}`
      );
  }

  executeCleanupCallbacks(): void {
    let executedCount = 0;
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
        executedCount++;
      } catch (error) {
        console.error(
          "❌ [ResourceManager] Failed to execute cleanup callback:",
          error
        );
      }
    });
    this.cleanupCallbacks.clear();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] Executed cleanup callbacks: ${executedCount}`
      );
  }

  cleanupAll(): void {
    __DEV__ &&
      console.log("🧹 [ResourceManager] Starting cleanup of all resources...");

    this.executeCleanupCallbacks();
    this.cleanupTimers();
    this.cleanupEventListeners();
    this.cleanupGlobalEventListeners();
    this.cleanupModelEventListeners();
    this.cleanupAudioContexts();
    this.cleanupWebGLContexts();

    this.resources.forEach((value, key) => {
      this.cleanupResource(key);
    });

    const resourceCount = this.getResourceCount();
    __DEV__ &&
      console.log(
        `🧹 [ResourceManager] All resources cleaned up (resources: ${JSON.stringify(resourceCount)})`
      );
  }

  getResourceCount(): ResourceCount {
    return {
      timers: this.timers.size,
      eventListeners: Array.from(this.eventListeners.values()).reduce(
        (sum, listeners) => sum + listeners.length,
        0
      ),
      globalEventListeners: Array.from(
        this.globalEventListeners.values()
      ).reduce((sum, listeners) => sum + listeners.length, 0),
      modelEventListeners: Array.from(this.modelEventListeners.values()).reduce(
        (sum, listeners) => sum + listeners.length,
        0
      ),
      audioContexts: this.audioContexts.size,
      webglContexts: this.webglContexts.size,
      cleanupCallbacks: this.cleanupCallbacks.size,
      resources: this.resources.size,
    };
  }

  getStats(): ResourceCount {
    console.warn(
      "⚠️ [ResourceManager] getStats is deprecated, use getResourceCount instead"
    );
    return this.getResourceCount();
  }

  hasUncleanedResources(): boolean {
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
