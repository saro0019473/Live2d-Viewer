/**
 * Live2D Manager — Facade / Coordinator
 *
 * This is the SINGLE public API that Vue components and Pinia stores use to
 * interact with the Live2D rendering system. Never touch sub-managers directly.
 *
 * Composition:
 *   Live2DManager
 *     ├── Live2DCoreManager     — PIXI Application, WebGL lifecycle
 *     ├── Live2DModelManager    — model load/unload, owns HeroModel instances
 *     ├── Live2DAnimationManager— expression/motion/audio playback
 *     └── Live2DInteractionManager — mouse/touch/zoom/eye-tracking
 *
 * Typical usage (from Live2DViewer.vue):
 *   const manager = new Live2DManager(containerEl)
 *   await manager.init()                // must await — async PIXI setup
 *   await manager.loadModel(url)        // loads + shows model
 *   manager.playMotion('Idle', 0)
 *   manager.destroy()                   // call on component unmount
 * See: docs/architecture.md
 */

import { Live2DCoreManager } from "./core-manager";
import { Live2DModelManager, type ModelData } from "./model-manager";
import { Live2DInteractionManager, type ZoomSettings } from "./interaction-manager";
import { Live2DAnimationManager, type AudioOptions, type AudioStatus } from "./animation-manager";
import { HeroModel } from "./hero-model";
import {
  getRecommendedSettings,
  checkWebGLSupport,
  createLogger,
  type Logger,
  type PerformanceSettings,
} from "./utils";

export class Live2DManager {
  public container: HTMLElement;
  public logger: Logger;
  public coreManager: Live2DCoreManager;
  public modelManager: Live2DModelManager;
  public animationManager: Live2DAnimationManager;
  public interactionManager: Live2DInteractionManager | null;
  public isInitialized: boolean;

  constructor(container: HTMLElement) {
    this.container = container;
    this.logger = createLogger("Live2DManager");

    // Initialize sub-managers
    this.coreManager = new Live2DCoreManager(container);
    this.modelManager = new Live2DModelManager(this.coreManager);
    this.animationManager = new Live2DAnimationManager(this.modelManager);

    // interactionManager will be created after coreManager is initialized
    this.interactionManager = null;

    this.isInitialized = false;
  }

  /**
   * Initialize the Live2D manager
   * @param {Partial<PerformanceSettings>} options - Initialization options
   */
  async init(options: Partial<PerformanceSettings> = {}): Promise<boolean> {
    try {
      this.logger.log("Starting initialization...");

      // Check WebGL support
      if (!checkWebGLSupport()) {
        throw new Error("Browser does not support WebGL, cannot run Live2D");
      }

      // Get recommended settings
      const recommendedSettings = getRecommendedSettings();
      const settings = { ...recommendedSettings, ...options };

      // Initialize core manager
      await this.coreManager.init();

      // Apply performance optimization settings
      this.coreManager.optimizePerformance(settings as Parameters<Live2DCoreManager["optimizePerformance"]>[0]);

      // Create interactionManager after coreManager is initialized
      this.interactionManager = new Live2DInteractionManager(
        this.coreManager,
        this.modelManager,
      );
      if (this.interactionManager) {
        // Bridge interactionManager to coreManager so modelManager can perform Pet Mode coordination
        (this.coreManager as any).interactionManager = this.interactionManager;
      }

      this.isInitialized = true;
      this.logger.log("Initialization complete");

      return true;
    } catch (error: any) {
      this.logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  // === Model Management API ===

  /**
   * Load a model
   * @param {ModelData} modelData - Model data
   * @returns {Promise<HeroModel>} Loaded model instance
   */
  async loadModel(modelData: ModelData): Promise<HeroModel> {
    try {
      this.logger.log("Starting model load:", modelData.id);

      // Use model manager to load the model
      const heroModel = await this.modelManager.loadModel(modelData);

      if (heroModel) {
        // interactionManager always exists after init
        // Bind interaction events
        this.interactionManager?.bindModelInteractionEvents(
          modelData.id,
          heroModel,
        );
        this.logger.log("Model loaded successfully:", modelData.id);
      }

      return heroModel;
    } catch (error) {
      this.logger.error("Model loading failed:", error);
      throw error;
    }
  }

  /**
   * Unload a model
   * @param {string} modelId - Model ID
   */
  unloadModel(modelId: string): void {
    try {
      this.logger.log("Starting model unload:", modelId);

      // Clean up interaction event listeners
      if (this.interactionManager) {
        this.interactionManager.cleanupModelEventListeners(modelId);
      }

      // Use model manager to unload the model
      this.modelManager.removeModel(modelId);

      this.logger.log("Model unloaded successfully:", modelId);
    } catch (error) {
      this.logger.error("Model unload failed:", error);
    }
  }

  /**
   * Switch model
   * @param {ModelData} modelData - New model data
   * @returns {Promise<HeroModel>} New model instance
   */
  async switchModel(modelData: ModelData): Promise<HeroModel> {
    try {
      this.logger.log("Starting model switch:", modelData.id);

      // Unload current model
      const currentModel = this.modelManager.getCurrentModel();
      if (currentModel) {
        // interactionManager always exists after init
        this.interactionManager?.cleanupModelEventListeners(currentModel.id);
        this.modelManager.removeModel(currentModel.id);
      }

      // Load new model
      const newModel = await this.loadModel(modelData);

      // Bind interaction events for the new model
      if (newModel) {
        // interactionManager always exists after init
        this.interactionManager?.bindModelInteractionEvents(
          modelData.id,
          newModel,
        );
      }

      this.logger.log("Model switch successful:", modelData.id);
      return newModel;
    } catch (error) {
      this.logger.error("Model switch failed:", error);
      throw error;
    }
  }

  /**
   * Auto-fit model to canvas size
   * @param {HeroModel | null} heroModel - Model instance
   */
  autoFitModelToCanvas(heroModel: HeroModel | null): void {
    if (!heroModel || !this.container) return;

    try {
      const canvasWidth = this.container.clientWidth;
      const canvasHeight = this.container.clientHeight;

      if (canvasWidth > 0 && canvasHeight > 0) {
        // Use a more conservative height ratio; landscape models will auto-adapt
        heroModel.autoFitToCanvas(canvasWidth, canvasHeight, 0.5);
      }
    } catch (error: any) {
      this.logger.debug(`Auto-fit to canvas failed: ${error.message}`);
    }
  }

  /**
   * Remove a model
   * @param {string} modelId - Model ID
   */
  removeModel(modelId: string): void {
    this.logger.log("Starting model removal:", modelId);

    try {
      const heroModel = this.modelManager.getModel(modelId);
      if (!heroModel) {
        this.logger.warn("Model does not exist:", modelId);
        return;
      }

      // 1. Stop all animations
      try {
        if (this.animationManager) {
          this.animationManager.stopMotionLoop(modelId);
          if (heroModel && (heroModel as any).stopAllMotions) {
            (heroModel as any).stopAllMotions();
          }
          this.logger.log("Stopped model animations:", modelId);
        }
      } catch (e: any) {
        this.logger.warn(`Failed to stop animations: ${e.message}`);
      }

      // 2. Clean up interaction events
      try {
        if (this.interactionManager) {
          this.interactionManager.cleanupModelEventListeners(modelId);
          this.logger.log("Cleaned up model interaction events:", modelId);
        }
      } catch (e: any) {
        this.logger.warn(`Failed to clean up interaction events: ${e.message}`);
      }

      // 3. Remove from model manager (this triggers model destruction)
      try {
        this.modelManager.removeModel(modelId);
        this.logger.log("Removed from model manager:", modelId);
      } catch (e: any) {
        this.logger.error(`Failed to remove from model manager: ${e.message}`);
        throw e;
      }

      this.logger.log(`Model removal complete: ${modelId}`);
    } catch (error: any) {
      this.logger.error(`Failed to remove model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh a model
   */
  async refreshModel(modelId: string, modelData: ModelData): Promise<HeroModel> {
    // Clean up old interaction events
    if (this.interactionManager) {
      this.interactionManager.cleanupModelEventListeners(modelId);
    }

    // Refresh the model
    const heroModel = await this.modelManager.refreshModel(modelId, modelData);

    // Re-bind interaction events
    if (heroModel && this.interactionManager) {
      this.interactionManager.bindModelInteractionEvents(modelId, heroModel);
    }

    return heroModel;
  }

  /**
   * Get a model
   * @param {string} modelId - Model ID
   * @returns {HeroModel|null} Model instance
   */
  getModel(modelId: string): HeroModel | null {
    return this.modelManager.getModel(modelId) || null;
  }

  /**
   * Check if a model exists
   * @param {string} modelId - Model ID
   * @returns {boolean} Whether the model exists
   */
  hasModel(modelId: string): boolean {
    return this.modelManager.hasModel(modelId);
  }

  /**
   * Get all models
   * @returns {HeroModel[]} All model instances
   */
  getAllModels(): HeroModel[] {
    return this.modelManager.getAllModels();
  }

  /**
   * Get all model IDs
   * @returns {string[]} All model IDs
   */
  getAllModelIds(): string[] {
    return this.modelManager.getAllModelIds();
  }

  /**
   * Get the current model
   * @returns {HeroModel|null} Current model instance
   */
  getCurrentModel(): HeroModel | null {
    return this.modelManager.getCurrentModel() || null;
  }

  /**
   * Set the current model
   * @param {string} modelId - Model ID
   */
  setCurrentModel(modelId: string): void {
    this.modelManager.setCurrentModel(modelId);
  }

  /**
   * Get the first available model
   * @returns {HeroModel|null} First available model
   */
  getFirstAvailableModel(): HeroModel | null {
    return this.modelManager.getFirstAvailableModel() || null;
  }

  // === Animation Control API ===

  /**
   * Play a motion
   */
  async playMotion(modelId: string, group: string, index: number, priority: number = 2): Promise<boolean> {
    return this.animationManager.playMotion(modelId, group, index, priority);
  }

  /**
   * Play a motion on loop — re-triggers the motion automatically each time it
   * finishes until stopMotionLoop() is called.
   * @param {string} modelId  - Model ID
   * @param {string} group    - Motion group name
   * @param {number} index    - Motion index within the group
   * @param {number} priority - Playback priority (default 2 = NORMAL)
   */
  async playMotionLoop(modelId: string, group: string, index: number, priority: number = 2): Promise<boolean> {
    return this.animationManager.playMotionLoop(
      modelId,
      group,
      index,
    );
  }

  /**
   * Stop the motion loop for a model.
   * @param {string} modelId - Model ID
   */
  stopMotionLoop(modelId: string): void {
    this.animationManager.stopMotionLoop(modelId);
  }

  /**
   * Check whether a motion loop is currently active for a model.
   * @param {string} modelId - Model ID
   * @returns {boolean}
   */
  isMotionLooping(modelId: string): boolean {
    return this.animationManager.isLooping(modelId);
  }

  /**
   * Play a random motion
   */
  async playRandomMotion(modelId: string, group: string | null = null): Promise<boolean> {
    return this.animationManager.playRandomMotion(modelId, group);
  }

  /**
   * Set an expression
   */
  setExpression(modelId: string, expressionIndex: number): boolean {
    return this.animationManager.setExpression(modelId, expressionIndex);
  }

  /**
   * Play a random expression
   */
  playRandomExpression(modelId: string): void {
    this.animationManager.playRandomExpression(modelId);
  }

  /**
   * Batch control expressions
   */
  batchControlExpressions(
    expressions: number[],
    modelIds: string[] | null = null,
  ): Array<{ modelId: string; expressionIndex: number; success: boolean }> {
    return this.animationManager.batchControlExpressions(expressions, modelIds);
  }

  /**
   * Batch control motions
   */
  async batchControlMotions(
    motions: Array<{ group: string; index: number; priority?: number }>,
    modelIds: string[] | null = null,
  ): Promise<Array<{ modelId: string; group: string; index: number; priority: number; success: boolean }>> {
    return this.animationManager.batchControlMotions(motions, modelIds);
  }

  /**
   * Play audio
   */
  async playAudio(audioUrl: string, options: AudioOptions = {}): Promise<boolean> {
    return this.animationManager.playAudio(audioUrl, options);
  }

  /**
   * Stop audio
   */
  stopAudio(): void {
    this.animationManager.stopAudio();
  }

  /**
   * Get audio status
   */
  getAudioStatus(): AudioStatus | null {
    return this.animationManager.getAudioStatus();
  }

  // === Interaction Control API ===

  /**
   * Set interaction enabled state
   * @param {boolean} enabled - Whether to enable
   */
  setInteractionEnabled(enabled: boolean): void {
    if (this.interactionManager) {
      this.interactionManager.setInteractionEnabled(enabled);
      this.logger.log(`🖱️ Interaction ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Set model drag enabled state.
   * Controls ONLY whether the model can be physically moved (dragged) by the
   * user.  Pointer events, click interactions, and mouse-follow remain active
   * regardless of this flag.
   * @param {boolean} enabled - Whether model dragging is allowed
   */
  setDragEnabled(enabled: boolean): void {
    if (!this.interactionManager) {
      this.logger.warn(
        "Interaction manager not initialized, cannot set drag state",
      );
      return;
    }

    try {
      this.interactionManager.setDragEnabled(enabled);
      this.logger.log(`🖱️ Model dragging ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      this.logger.error("Failed to set drag state:", error);
    }
  }

  /**
   * Set mouse-follow enabled state
   * @param {boolean} enabled - Whether model should follow mouse
   */
  setLookAtMouseEnabled(enabled: boolean): void {
    if (!this.interactionManager) {
      this.logger.warn(
        "Interaction manager not initialized, cannot set mouse-follow",
      );
      return;
    }

    try {
      this.interactionManager.setLookAtMouseEnabled(enabled);
      this.logger.log(`👀 Mouse-follow ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      this.logger.error("Failed to set mouse-follow state:", error);
    }
  }

  /**
   * Set model position
   * @param {string} modelId - Model ID
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  setModelPosition(modelId: string, x: number, y: number): void {
    if (this.interactionManager) {
      return this.interactionManager.setModelPosition(modelId, x, y);
    }
  }

  /**
   * Get current zoom settings
   * @returns {ZoomSettings|null} Current zoom settings
   */
  getZoomSettings(): ZoomSettings | null {
    if (!this.interactionManager) {
      return null;
    }

    try {
      return this.interactionManager.getZoomSettings();
    } catch (error) {
      this.logger.error("Failed to get zoom settings:", error);
      return null;
    }
  }

  /**
   * Update zoom settings
   * @param {Object} settings - Zoom settings object
   * @param {number} [settings.zoomSpeed] - Zoom step
   * @param {number} [settings.minScale] - Minimum scale value
   * @param {number} [settings.maxScale] - Maximum scale value
   */
  updateZoomSettings(settings: Partial<ZoomSettings & { zoomSpeed?: number }>): void {
    if (!this.interactionManager) {
      this.logger.warn(
        "Interaction manager not initialized, cannot update zoom settings",
      );
      return;
    }

    try {
      this.interactionManager.updateZoomSettings(settings);
      this.logger.log("Zoom settings updated:", settings);
    } catch (error) {
      this.logger.error("Failed to update zoom settings:", error);
    }
  }

  /**
   * Set wheel zoom enabled state
   * @param {boolean} enabled - Whether to enable wheel zoom
   */
  setWheelZoomEnabled(enabled: boolean): void {
    if (!this.interactionManager) {
      this.logger.warn(
        "Interaction manager not initialized, cannot set wheel zoom",
      );
      return;
    }

    try {
      this.interactionManager.setWheelZoomEnabled(enabled);
      this.logger.log("Wheel zoom state set:", enabled);
    } catch (error) {
      this.logger.error("Failed to set wheel zoom state:", error);
    }
  }

  // === Performance and Settings API ===

  /**
   * Update performance settings
   */
  updatePerformanceSettings(settings: Partial<PerformanceSettings>): void {
    this.coreManager.optimizePerformance(settings as Parameters<Live2DCoreManager["optimizePerformance"]>[0]);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): ReturnType<Live2DCoreManager["getPerformanceStats"]> {
    return this.coreManager.getPerformanceStats();
  }

  /**
   * Pause/resume rendering
   */
  setPaused(paused: boolean): void {
    this.coreManager.setPaused(paused);
  }

  /**
   * Update canvas dimensions
   */
  resize(width: number, height: number): void {
    this.coreManager.resize(width, height);
    this.modelManager.repositionModels();

    // Auto-fit all models to the new canvas size
    this.autoFitAllModelsToCanvas(width, height);
  }

  /**
   * Auto-fit all models to canvas size
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  autoFitAllModelsToCanvas(width: number, height: number): void {
    if (!width || !height) return;

    try {
      const models = this.modelManager.getAllModels();
      models.forEach((heroModel) => {
        if (heroModel && heroModel.autoFitToCanvas) {
          // Use a more conservative height ratio; landscape models will auto-adapt
          heroModel.autoFitToCanvas(width, height, 0.5);
        }
      });
    } catch (error: any) {
      this.logger.debug(
        `Failed to auto-fit all models to canvas: ${error.message}`,
      );
    }
  }

  /**
   * Destroy the Live2D manager
   */
  destroy(): void {
    this.logger.log("Starting Live2D manager destruction...");

    try {
      // Destroy interaction manager
      if (this.interactionManager) {
        this.interactionManager.destroy();
      }

      // Destroy other managers
      if (this.animationManager) {
        this.animationManager.destroy();
      }

      if (this.modelManager) {
        this.modelManager.clear();
      }

      if (this.coreManager) {
        this.coreManager.destroy();
      }

      this.isInitialized = false;
      this.logger.log("Live2D manager destruction complete");
    } catch (error: any) {
      this.logger.error(`Failed to destroy Live2D manager: ${error.message}`);
    }
  }

  // === Direct sub-manager access ===
  get interaction(): Live2DInteractionManager | null {
    return this.interactionManager;
  }

  get model(): Live2DModelManager {
    return this.modelManager;
  }

  get animation(): Live2DAnimationManager {
    return this.animationManager;
  }

  get core(): Live2DCoreManager {
    return this.coreManager;
  }
}
