/**
 * Live2D Core Manager - 核心管理器
 * 负责PIXI应用初始化、基础设置和生命周期管理
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
  }

  /**
   * 初始化 PIXI 应用和场景
   */
  async init() {
    try {
      // 等待 Live2D 库加载
      await waitForLive2D();

      // 清理现有的 viewer
      const existingViewer = document.getElementById("live2d-canvas");
      if (existingViewer) {
        existingViewer.remove();
      }

      // 创建 PIXI 应用
      this.app = this.createPixiApplication();

      // 设置渲染器优化
      this.setupRenderer();

      // 设置全局引用
      globalThis.__PIXI_APP__ = this.app;

      // 添加到容器并配置Canvas事件
      this.app.view.setAttribute("id", "live2d-canvas");
      this.app.view.style.pointerEvents = "auto";
      this.app.view.style.touchAction = "none";
      this.app.view.style.userSelect = "none";
      this.container.appendChild(this.app.view);

      // 创建模型容器并设置交互性
      this.modelContainer = new window.PIXI.Container();
      this.modelContainer.interactive = true;
      this.modelContainer.interactiveChildren = true;

      // PIXI 7.x 兼容性设置 - 使用dynamic模式以支持containsPoint检测
      if (typeof this.modelContainer.eventMode !== "undefined") {
        this.modelContainer.eventMode = "dynamic";
      }

      // 确保Stage交互性（已在createPixiApplication中设置）
      if (typeof this.app.stage.eventMode !== "undefined") {
        this.app.stage.eventMode = "dynamic";
      }

      this.app.stage.addChild(this.modelContainer);

      this.isInitialized = true;
      this.logger.log("✅ 初始化完成，使用PIXI事件系统");
    } catch (error) {
      this.logger.error("❌ 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 创建PIXI应用实例
   */
  createPixiApplication() {
    // 根据设备性能动态决定 antialias / resolution / powerPreference
    const recommended = getRecommendedSettings();

    const app = new window.PIXI.Application({
      // 基础设置
      autoDensity: true,
      resolution: recommended.resolution || window.devicePixelRatio || 1,
      width: this.container.offsetWidth,
      height: this.container.offsetHeight,

      // 性能优化设置（根据设备能力动态调整）
      antialias: recommended.antialias ?? true,
      powerPreference: recommended.powerPreference || "high-performance",
      backgroundAlpha: 0,
      clearBeforeRender: true,
      preserveDrawingBuffer: false,

      // WebGL设置
      forceCanvas: false,

      // 渲染器设置
      sharedTicker: true,
      sharedLoader: true,
    });

    this.logger.log(
      `📊 设备性能适配: antialias=${recommended.antialias}, resolution=${recommended.resolution}, power=${recommended.powerPreference}`,
    );

    // PIXI 7.x 兼容性：手动设置交互性
    if (app.stage) {
      // 使用PIXI 7.x的交互系统
      app.stage.interactive = true;
      app.stage.interactiveChildren = true;

      // 如果支持新的事件模式，则使用dynamic模式
      if (typeof app.stage.eventMode !== "undefined") {
        app.stage.eventMode = "dynamic";
      }
    }

    return app;
  }

  /**
   * 设置渲染器优化
   */
  setupRenderer() {
    if (!this.app.renderer) return;

    // 启用批处理
    this.app.renderer.plugins.batch.size = 8192;

    // 设置渲染模式
    this.app.renderer.roundPixels = true;

    // 优化纹理设置 - PIXI 7.x兼容性处理
    if (this.app.renderer.texture) {
      // 检查MSAA_QUALITY是否可用
      if (window.PIXI.MSAA_QUALITY) {
        this.app.renderer.texture.multisample = window.PIXI.MSAA_QUALITY.HIGH;
      }
    }

    // 设置ticker性能优化
    this.app.ticker.maxFPS = 60;
    this.app.ticker.minFPS = 30;
  }

  /**
   * 更新画布尺寸
   */
  resize(width, height) {
    if (!this.app) return;

    this.app.renderer.resize(width, height);
  }

  /**
   * 优化PIXI性能设置
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

    // 设置FPS限制
    this.app.ticker.maxFPS = maxFPS;
    this.app.ticker.minFPS = minFPS;

    // 启用视锥剔除
    if (enableCulling && this.modelContainer) {
      this.modelContainer.cullable = true;
    }

    // 批处理优化
    if (enableBatching && this.app.renderer.plugins.batch) {
      this.app.renderer.plugins.batch.size = 8192;
    }

    // 纹理垃圾回收
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
   * 暂停/恢复渲染
   */
  setPaused(paused) {
    if (!this.app) return;

    if (paused) {
      this.app.ticker.stop();
      this.logger.log("⏸️ 渲染已暂停");
    } else {
      this.app.ticker.start();
      this.logger.log("▶️ 渲染已恢复");
    }
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    if (!this.app) return null;

    return {
      fps: this.app.ticker.FPS,
      deltaTime: this.app.ticker.deltaTime,
      elapsedMS: this.app.ticker.elapsedMS,
      lastTime: this.app.ticker.lastTime,
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
   * 销毁核心管理器
   */
  destroy() {
    this.logger.log("🧹 开始销毁核心管理器");

    // 销毁 PIXI 应用
    if (this.app) {
      this.app.destroy(true, true);
      this.app = null;
    }

    // 清理容器
    if (this.container && this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    this.modelContainer = null;
    this.isInitialized = false;

    this.logger.log("🧹 核心管理器已销毁");
  }
}
