/**
 * Live2D Interaction Manager
 * Unified management of model interaction events
 */

import { globalResourceManager } from "../resource-manager";
import { createLogger, type Logger } from "./utils";
import type { Live2DCoreManager } from "./core-manager";
import type { Live2DModelManager } from "./model-manager";
import type { HeroModel } from "./hero-model";

export interface ZoomSettings {
  enabled: boolean;
  step: number;
  minScale: number; // Default minimum scale
  maxScale: number; // Default maximum scale
}

export interface Position {
  x: number;
  y: number;
}

export interface ClickArea {
  x: number;
  y: number;
  width: number;
  height: number;
  motion?: string;
  [key: string]: any;
}

export class Live2DInteractionManager {
  public coreManager: Live2DCoreManager;
  public modelManager: Live2DModelManager;
  public logger: Logger;

  // Interaction configuration
  public isEnabled: boolean;
  public isDragEnabled: boolean;
  public isDesktopMode: boolean;
  public zoomSettings: ZoomSettings;

  // Event state
  public isDragging: boolean;
  public hasDragged: boolean;
  public dragStartPos: Position;
  public dragStartModelPos: Position;
  public dragModelId: string | null;
  public clickThreshold: number;

  // Mouse follow state
  public lookAtMouseEnabled: boolean;

  // Mouse tracking state
  public mousePosition: Position;
  public hoveredModel: HeroModel | null;

  // Event listener management
  public globalEventListeners: Map<string, any>;

  // Click area configuration
  public clickAreas: Map<string, ClickArea[]>; // Store click area config for each model

  private _canvasWheelHandler: ((event: WheelEvent) => void) | null = null;

  constructor(coreManager: Live2DCoreManager, modelManager: Live2DModelManager) {
    this.coreManager = coreManager;
    this.modelManager = modelManager;
    this.logger = createLogger("Live2DInteractionManager");

    // Interaction configuration
    this.isEnabled = true;
    // isDragEnabled controls ONLY model dragging (moving the model with pointer).
    // Disabling drag does NOT disable click events or mouse-follow.
    this.isDragEnabled = true;
    this.isDesktopMode = false;
    this.zoomSettings = {
      enabled: true,
      step: 0.01,
      minScale: 0.01, // Default minimum scale
      maxScale: 5.0, // Default maximum scale
    };

    // Event state
    this.isDragging = false;
    this.hasDragged = false;
    this.dragStartPos = { x: 0, y: 0 };
    this.dragStartModelPos = { x: 0, y: 0 };
    this.dragModelId = null;
    this.clickThreshold = 5; // Click detection threshold (pixels)

    // Mouse follow state
    this.lookAtMouseEnabled = false;

    // Mouse tracking state
    this.mousePosition = { x: 0, y: 0 };
    this.hoveredModel = null;

    // Use ResourceManager for unified event listener management
    this.globalEventListeners = new Map<string, any>();

    // Click area configuration
    this.clickAreas = new Map<string, ClickArea[]>();

    // Initialize
    this.initialize();
  }

  /**
   * Initialize interaction manager
   */
  public initialize(): void {
    try {
      // Set stage as interactive
      if (this.coreManager.app?.stage) {
        this.coreManager.app.stage.interactive = true;
        this.coreManager.app.stage.cursor = "pointer";
      }

      // Bind global event listeners
      this.bindGlobalEventListeners();
    } catch (error) {
      this.logger.error("❌ Initialization failed:", error);
    }
  }

  /**
   * Bind global event listeners
   */
  public bindGlobalEventListeners(): void {
    const globalMouseMoveHandler = (event: Event) => {
      this.handleGlobalMouseMove(event);
    };

    globalResourceManager.registerGlobalEventListener(
      "interaction-mousemove",
      "mousemove",
      globalMouseMoveHandler,
    );

    // Wheel zoom listener is now managed uniformly by setWheelZoomEnabled
    // Enable based on current settings
    if (this.zoomSettings.enabled) {
      this.setWheelZoomEnabled(true);
    }
  }

  /**
   * Handle wheel zoom event
   * @param {WheelEvent} event - Wheel event
   */
  public handleWheelZoom(event: WheelEvent): void {
    if (!this.zoomSettings.enabled) return;

    try {
      // Update mouse position
      this.mousePosition.x = event.clientX;
      this.mousePosition.y = event.clientY;

      // Zoom the currently hovered model
      if (this.hoveredModel) {
        const modelId = this.modelManager.getModelId(this.hoveredModel);
        if (!modelId) return;

        // Get current scale value
        const currentScale = this.hoveredModel.getScale().x;

        // Calculate zoom direction
        const delta = event.deltaY > 0 ? -1 : 1;

        // Calculate new scale value
        let newScale = currentScale + delta * this.zoomSettings.step;

        // Clamp scale range
        newScale = Math.max(
          this.zoomSettings.minScale,
          Math.min(this.zoomSettings.maxScale, newScale),
        );

        // Apply scale
        this.hoveredModel.setScale(newScale);
        return;
      }

      // If no hovered model, try using PIXI's getObjectsUnderPoint
      const mousePoint = new (window as any).PIXI.Point(
        this.mousePosition.x,
        this.mousePosition.y,
      );

      if (
        this.coreManager.app?.renderer &&
        this.coreManager.app.renderer.getObjectsUnderPoint
      ) {
        try {
          const objects =
            this.coreManager.app.renderer.getObjectsUnderPoint(mousePoint);
          if (objects && objects.length > 0) {
            // Find the topmost model object
            for (const obj of objects) {
              const models = this.modelManager.getAllModels();
              for (const model of models) {
                if (
                  model.model &&
                  (model.model === obj || model.model.children?.includes(obj))
                ) {
                  // Get current scale value
                  const currentScale = model.getScale().x;

                  // Calculate zoom direction
                  const delta = event.deltaY > 0 ? -1 : 1;

                  // Calculate new scale value
                  let newScale = currentScale + delta * this.zoomSettings.step;

                  // Clamp scale range
                  newScale = Math.max(
                    this.zoomSettings.minScale,
                    Math.min(this.zoomSettings.maxScale, newScale),
                  );

                  // Apply scale
                  model.setScale(newScale);
                  return;
                }
              }
            }
          }
        } catch (error) {
          this.logger.warn("⚠️ getObjectsUnderPoint failed:", error);
        }
      }
    } catch (error) {
      this.logger.error("❌ Failed to handle wheel zoom:", error);
    }
  }

  /**
   * Set desktop pet mode
   * @param {boolean} enabled - Whether to enable desktop pet mode
   */
  public setDesktopMode(enabled: boolean): void {
    this.isDesktopMode = enabled;

    if (enabled) {
      this.updateDesktopModeLayout();
    }
  }

  /**
   * Update desktop pet mode layout
   */
  public updateDesktopModeLayout(): void {
    if (!this.isDesktopMode) return;

    const models = this.modelManager.getAllModels();
    models.forEach((model) => {
      // Layout logic in desktop pet mode
      const position = this.calculateDesktopPosition(model.id);
      this.setModelPosition(model.id, position.x, position.y);
    });
  }

  /**
   * Calculate desktop pet mode position
   * @param {string} modelId - Model ID
   * @returns {Position} Position coordinates
   */
  public calculateDesktopPosition(modelId: string): Position {
    // Simple desktop pet mode position calculation
    const index = this.modelManager.getAllModelIds().indexOf(modelId);
    const spacing = 100;
    return {
      x: 50 + index * spacing,
      y: window.innerHeight - 200,
    };
  }

  /**
   * Set model position
   * @param {string} modelId - Model ID
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  public setModelPosition(modelId: string, x: number, y: number): void {
    const model = this.modelManager.getModel(modelId);
    if (!model) return;

    model.setPosition(x, y);
  }

  /**
   * Get model position
   * @param {string} modelId - Model ID
   * @returns {Position} Position coordinates
   */
  public getModelPosition(modelId: string): Position {
    const model = this.modelManager.getModel(modelId);
    if (!model) return { x: 0, y: 0 };

    return model.getPosition();
  }

  /**
   * Bind model interaction events
   * @param {string} modelId - Model ID
   * @param {HeroModel} model - Model instance
   */
  public bindModelInteractionEvents(modelId: string, model: HeroModel): void {
    if (!model || !model.model) {
      this.logger.warn(
        "⚠️ Invalid model, cannot bind interaction events:",
        modelId,
      );
      return;
    }

    const pixiModel = model.model;

    // Set model as interactive
    pixiModel.interactive = true;
    // PIXI 7.x: use cursor instead of buttonMode
    pixiModel.cursor = "pointer";
    if (typeof pixiModel.eventMode !== "undefined") {
      pixiModel.eventMode = "dynamic";
    }

    // Pointer down event
    const pointerDownHandler = (event: any) => {
      this.handlePointerDown(modelId, event);
    };

    // Pointer move event
    const pointerMoveHandler = (event: any) => {
      this.handlePointerMove(modelId, event);
    };

    // Pointer up event
    const pointerUpHandler = (event: any) => {
      this.handlePointerUp(modelId, event);
    };

    // Pointer over event
    const pointerOverHandler = () => {
      this.hoveredModel = model;
    };

    // Pointer out event
    const pointerOutHandler = () => {
      if (this.hoveredModel === model) {
        this.hoveredModel = null;
      }
    };

    // Register event listeners with ResourceManager
    globalResourceManager.registerModelEventListener(
      modelId,
      "pointerdown",
      pointerDownHandler,
    );
    globalResourceManager.registerModelEventListener(
      modelId,
      "pointermove",
      pointerMoveHandler,
    );
    globalResourceManager.registerModelEventListener(
      modelId,
      "pointerup",
      pointerUpHandler,
    );
    globalResourceManager.registerModelEventListener(
      modelId,
      "pointerover",
      pointerOverHandler,
    );
    globalResourceManager.registerModelEventListener(
      modelId,
      "pointerout",
      pointerOutHandler,
    );

    // Bind to PIXI model
    pixiModel.on("pointerdown", pointerDownHandler);
    pixiModel.on("pointermove", pointerMoveHandler);
    pixiModel.on("pointerup", pointerUpHandler);
    pixiModel.on("pointerover", pointerOverHandler);
    pixiModel.on("pointerout", pointerOutHandler);
  }

  /**
   * Handle pointer down event
   * @param {string} modelId - Model ID
   * @param {any} event - Event object
   */
  public handlePointerDown(modelId: string, event: any): void {
    if (!this.isEnabled) return;

    const model = this.modelManager.getModel(modelId);
    if (!model) return;

    // Only start drag tracking when drag is enabled
    if (this.isDragEnabled) {
      this.isDragging = true;
      this.hasDragged = false;
      this.dragModelId = modelId;
      this.dragStartPos = { x: event.data.global.x, y: event.data.global.y };
      this.dragStartModelPos = model.getPosition();
    } else {
      // Still track pointer down position for click detection even when drag is off
      this.isDragging = false;
      this.hasDragged = false;
      this.dragModelId = modelId;
      this.dragStartPos = { x: event.data.global.x, y: event.data.global.y };
      this.dragStartModelPos = model.getPosition();
    }
  }

  /**
   * Handle pointer move event
   * @param {string} modelId - Model ID
   * @param {any} event - Event object
   */
  public handlePointerMove(modelId: string, event: any): void {
    if (!this.isEnabled) return;

    // Only move the model when drag is enabled and actively dragging
    if (this.isDragEnabled && this.isDragging && this.dragModelId === modelId) {
      const model = this.modelManager.getModel(modelId);
      if (!model) return;

      const currentPos = { x: event.data.global.x, y: event.data.global.y };
      const deltaX = currentPos.x - this.dragStartPos.x;
      const deltaY = currentPos.y - this.dragStartPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > this.clickThreshold) {
        this.hasDragged = true;
      }

      if (this.hasDragged) {
        const newX = this.dragStartModelPos.x + deltaX;
        const newY = this.dragStartModelPos.y + deltaY;
        model.setPosition(newX, newY);
      }
    }
  }

  /**
   * Handle pointer up event
   * @param {string} modelId - Model ID
   * @param {any} event - Event object
   */
  public handlePointerUp(modelId: string, event: any): void {
    if (!this.isEnabled) {
      this.isDragging = false;
      this.hasDragged = false;
      this.dragModelId = null;
      return;
    }

    const model = this.modelManager.getModel(modelId);
    if (!model) {
      this.isDragging = false;
      this.hasDragged = false;
      this.dragModelId = null;
      return;
    }

    const currentPos = { x: event.data.global.x, y: event.data.global.y };
    const deltaX = currentPos.x - this.dragStartPos.x;
    const deltaY = currentPos.y - this.dragStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Only treat as click if no drag occurred (works whether drag is enabled or not)
    if (
      this.dragModelId === modelId &&
      !this.hasDragged &&
      distance < this.clickThreshold
    ) {
      this.handleModelClick(modelId, event);
    }

    this.isDragging = false;
    this.hasDragged = false;
    this.dragModelId = null;
  }

  /**
   * Handle model click
   * @param {string} modelId - Model ID
   * @param {any} event - Event object
   */
  public handleModelClick(modelId: string, event: any): void {
    const model = this.modelManager.getModel(modelId);
    if (!model) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return;
    }

    // Get click coordinates
    const globalPos = event.data.global;

    // Convert to model local coordinates
    const localPos = this.convertToModelCoordinates(model, globalPos);

    // Check click areas
    const hitArea = this.getHitArea(model, localPos);
    if (hitArea) {
      this.playHitAreaMotion(model, hitArea);
    } else {
      this.playRandomMotion(model);
    }
  }

  /**
   * Convert coordinates to model local coordinate system
   * @param {HeroModel} model - Model instance
   * @param {Position} globalPos - Global coordinates
   * @returns {Position} Local coordinates
   */
  public convertToModelCoordinates(model: HeroModel, globalPos: Position): Position {
    try {
      const globalPoint = new (window as any).PIXI.Point(globalPos.x, globalPos.y);
      const localPoint = model.model.toLocal(globalPoint);

      return {
        x: localPoint.x,
        y: localPoint.y,
      };
    } catch (error) {
      this.logger.error("❌ Coordinate conversion failed:", error);
      return globalPos;
    }
  }

  /**
   * Get hit area
   * @param {HeroModel} model - Model instance
   * @param {Position} localPos - Local coordinates
   * @returns {ClickArea|null} Hit area information
   */
  public getHitArea(model: HeroModel, localPos: Position): ClickArea | null {
    try {
      const hitAreas = this.clickAreas.get(model.id) || [];

      for (const area of hitAreas) {
        if (this.isPointInArea(localPos, area)) {
          return area;
        }
      }

      return null;
    } catch (error) {
      this.logger.error("❌ Failed to get hit area:", error);
      return null;
    }
  }

  /**
   * Check if a point is within an area
   * @param {Position} point - Point coordinates
   * @param {ClickArea} area - Area information
   * @returns {boolean} Whether the point is within the area
   */
  public isPointInArea(point: Position, area: ClickArea): boolean {
    try {
      return (
        point.x >= area.x &&
        point.x <= area.x + area.width &&
        point.y >= area.y &&
        point.y <= area.y + area.height
      );
    } catch (error) {
      this.logger.error("❌ Area check failed:", error);
      return false;
    }
  }

  /**
   * Play hit area motion
   * @param {HeroModel} model - Model instance
   * @param {ClickArea} hitArea - Hit area
   */
  public playHitAreaMotion(model: HeroModel, hitArea: ClickArea): void {
    if (!hitArea.motion) return;

    try {
      const [group, index] = hitArea.motion.split("_");
      model.playMotion(group, parseInt(index, 10));
    } catch (error) {
      this.logger.error(
        "❌ Failed to play hit area motion, falling back to random motion:",
        error,
      );
      this.playRandomMotion(model);
    }
  }

  /**
   * Play random motion
   * @param {HeroModel} model - Model instance
   */
  public playRandomMotion(model: HeroModel): void {
    try {
      model.playRandomMotion();
    } catch (error) {
      this.logger.error("❌ Failed to play random motion:", error);
    }
  }

  /**
   * Clear model click areas
   * @param {string} modelId - Model ID
   */
  public clearModelClickAreas(modelId: string): void {
    this.clickAreas.delete(modelId);
  }

  public handleGlobalMouseMove(event: Event): void {
    // Only track mouse position for other uses (e.g. desktop mode layout).
    // Mouse-follow / head-gaze is handled entirely by pixi-live2d's built-in
    // autoFocus mechanism (model.automator.autoFocus), which is toggled by
    // setLookAtMouseEnabled().  Calling model.focus() here with DOM
    // clientX/clientY coordinates was incorrect because pixi-live2d's focus()
    // expects PIXI global pixel coordinates (event.global.x/y), not
    // canvas-relative DOM coordinates, causing wrong gaze direction.
    const mouseEvent = event as MouseEvent;
    this.mousePosition = { x: mouseEvent.clientX, y: mouseEvent.clientY };
  }

  /**
   * Clean up model event listeners
   * @param {string} modelId - Model ID
   */
  public cleanupModelEventListeners(modelId: string): void {
    const model = this.modelManager.getModel(modelId);
    if (!model || !model.model) {
      return;
    }

    try {
      // Remove PIXI event listeners
      model.model.off("pointerdown");
      model.model.off("pointermove");
      model.model.off("pointerup");
      model.model.off("pointerover");
      model.model.off("pointerout");

      // Clean up hover state
      if (this.hoveredModel === model) {
        this.hoveredModel = null;
      }

      // Clean up from ResourceManager
      globalResourceManager.cleanupResource("modelEventListener", modelId);
    } catch (error) {
      this.logger.error(
        "❌ Failed to clean up model event listeners:",
        modelId,
        error,
      );
    }
  }

  /**
   * Clean up all event listeners
   */
  public cleanupAllEventListeners(): void {
    try {
      // Clean up model event listeners
      globalResourceManager.cleanupModelEventListeners();

      // Clean up global event listeners
      globalResourceManager.cleanupResource(
        "globalEventListener",
        "interaction-mousemove",
      );

      // Clean up canvas wheel event listeners
      this.setWheelZoomEnabled(false);
    } catch (error) {
      this.logger.error("❌ Failed to clean up all event listeners:", error);
    }
  }

  /**
   * Destroy interaction manager
   */
  public destroy(): void {
    try {
      // Clean up all event listeners
      this.cleanupAllEventListeners();

      // Clean up click areas
      this.clickAreas.clear();

      // Reset state
      this.isDragging = false;
      this.dragStartPos = { x: 0, y: 0 };
      this.dragStartModelPos = { x: 0, y: 0 };
    } catch (error) {
      this.logger.error("❌ Failed to destroy interaction manager:", error);
    }
  }

  /**
   * Set wheel zoom enabled state
   * @param {boolean} enabled - Whether to enable
   */
  public setWheelZoomEnabled(enabled: boolean): void {
    this.zoomSettings.enabled = enabled;

    // Get canvas element
    const canvas = this.coreManager?.app?.view;
    if (!canvas) {
      this.logger.warn("⚠️ Canvas not found, cannot bind wheel zoom");
      return;
    }

    if (enabled) {
      // Listen for wheel events only on the canvas
      const wheelHandler = (event: WheelEvent) => {
        event.preventDefault();
        this.handleWheelZoom(event);
      };
      // Unbind first to prevent duplicates
      if (this._canvasWheelHandler) {
        canvas.removeEventListener("wheel", this._canvasWheelHandler);
      }
      canvas.addEventListener("wheel", wheelHandler, { passive: false });
      this._canvasWheelHandler = wheelHandler;
    } else {
      // Unbind wheel events on the canvas
      if (this._canvasWheelHandler) {
        canvas.removeEventListener("wheel", this._canvasWheelHandler);
        this._canvasWheelHandler = null;
      }
    }
  }

  /**
   * Set drag enabled state — controls ONLY whether the model can be moved by
   * dragging.  Pointer events on the model remain active so that click
   * interactions and mouse-follow continue to work regardless of this flag.
   * @param {boolean} enabled - Whether model dragging is allowed
   */
  public setDragEnabled(enabled: boolean): void {
    this.isDragEnabled = enabled;

    if (!enabled) {
      // Cancel any drag that may be in progress
      this.isDragging = false;
      this.hasDragged = false;
      this.dragModelId = null;
    }

    this.logger.log(`🖱️ Model dragging ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Set overall interaction enabled state.
   * When disabled the model receives no pointer events at all (no drag, no
   * click, no hover).  Mouse-follow via the global mousemove listener is NOT
   * affected — that is controlled separately by setLookAtMouseEnabled().
   * @param {boolean} enabled - Whether to enable pointer interactions
   */
  public setInteractionEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (!enabled) {
      this.isDragging = false;
      this.hasDragged = false;
      this.dragModelId = null;
    }

    // Update PIXI event mode for all models.
    // We keep the model's eventMode as "dynamic" when interaction is disabled
    // so that the global mousemove can still reach pixi-live2d's focus() logic.
    // Only the isEnabled flag gates the drag / click handlers above.
    const models = this.modelManager.getAllModels();
    models.forEach((model) => {
      if (model.model) {
        model.model.interactive = enabled;
        model.model.cursor = enabled ? "pointer" : null;
        if (typeof model.model.eventMode !== "undefined") {
          // Keep "dynamic" so the PIXI stage still dispatches pointer events
          // for mouse-follow even when interaction (drag/click) is disabled.
          model.model.eventMode = enabled ? "dynamic" : "none";
        }
      }
    });
  }

  /**
   * Update zoom settings
   * @param {Partial<ZoomSettings & { zoomSpeed?: number }>} settings - Zoom settings object
   */
  public updateZoomSettings(settings: Partial<ZoomSettings & { zoomSpeed?: number }>): void {
    if (!settings) return;

    try {
      if (settings.zoomSpeed !== undefined) {
        this.zoomSettings.step = Math.max(
          0.001,
          Math.min(0.1, settings.zoomSpeed),
        );
      }
      if (settings.minScale !== undefined) {
        this.zoomSettings.minScale = Math.max(0.01, settings.minScale); // Ensure minimum is 0.01
      }
      if (settings.maxScale !== undefined) {
        this.zoomSettings.maxScale = Math.min(10.0, settings.maxScale); // Ensure maximum is 10.0
      }
    } catch (error) {
      this.logger.error("❌ Failed to update zoom settings:", error);
    }
  }

  /**
   * Get current zoom settings
   * @returns {ZoomSettings} Current zoom settings
   */
  public getZoomSettings(): ZoomSettings {
    return { ...this.zoomSettings };
  }

  /**
   * Set mouse-follow enabled state
   * @param {boolean} enabled - Whether the model should follow mouse movement
   */
  public setLookAtMouseEnabled(enabled: boolean): void {
    this.lookAtMouseEnabled = enabled;

    // Mouse-follow is implemented via pixi-live2d's built-in autoFocus
    // (model.automator.autoFocus).  When autoFocus=true pixi-live2d registers
    // a global pointermove listener that calls focus() with the correct PIXI
    // global coordinates.  We simply toggle that flag here instead of trying
    // to replicate the same logic manually with DOM coordinates.
    const models = this.modelManager.getAllModels();
    models.forEach((model) => {
      if (!model?.model) return;

      // Toggle pixi-live2d's built-in autoFocus.
      if (model.model.automator) {
        model.model.automator.autoFocus = enabled;
      }

      if (!enabled) {
        // Reset the focusController so the head returns to neutral / motion
        // driven position instead of staying locked on the last cursor point.
        if (model.model.internalModel?.focusController) {
          try {
            model.model.internalModel.focusController.focus(0, 0, true);
          } catch (_) {
            // API may differ across pixi-live2d versions — silently ignore
          }
        }
      }
    });
  }
}
