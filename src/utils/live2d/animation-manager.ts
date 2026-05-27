/**
 * Live2D Animation Manager
 * Handles model motions, expressions, and audio playback
 */

import { createLogger, type Logger } from "./utils";
import type { Live2DModelManager } from "./model-manager";
import type { HeroModel } from "./hero-model";

export interface LoopState {
  group: string;
  index: number;
  active: boolean;
}

export interface MotionQueueItem {
  group: string;
  index: number;
  priority?: number;
}

export interface AudioOptions {
  volume?: number;
  loop?: boolean;
  playbackRate?: number;
}

export interface AudioStatus {
  playing: boolean;
  paused: boolean;
  currentTime: number;
  duration: number;
  volume?: number;
}

export class Live2DAnimationManager {
  public modelManager: Live2DModelManager;
  public currentAudioPlayer: HTMLAudioElement | null;
  public animationQueue: Map<string, any>;
  public isPlaying: Map<string, boolean>;
  public isPetMode: boolean;
  public audioEnabled: boolean;
  public audioVolume: number;
  public logger: Logger;
  private _loopState: Map<string, LoopState>;

  constructor(modelManager: Live2DModelManager) {
    this.modelManager = modelManager;
    this.currentAudioPlayer = null;
    this.animationQueue = new Map<string, any>();
    this.isPlaying = new Map<string, boolean>();
    this.isPetMode = false;
    this.audioEnabled = true;
    this.audioVolume = 1.0;
    this.logger = createLogger("Live2DAnimationManager");

    // Motion loop state: Map<modelId, { group, index, active }>
    // Uses CubismMotion._isLoop (native SDK loop) — no event listeners or
    // fallback timers needed; the SDK handles iteration internally.
    this._loopState = new Map<string, LoopState>();
  }

  /**
   * Set pet mode
   * @param {boolean} enabled - Whether to enable pet mode
   */
  public setPetMode(enabled: boolean): void {
    this.isPetMode = enabled;
    this.logger.log(`🐾 Pet mode ${enabled ? "enabled" : "disabled"}`);

    if (enabled) {
      // Stop all current animations
      this.stopAllAnimations();

      // Stop audio playback
      this.stopAudio();
    }
  }

  // ── Motion Loop API ──────────────────────────────────────────────────────

  /**
   * Start looping a specific motion for a model.
   *
   * Relies on the `motionFinish` event emitted by pixi-live2d's MotionManager
   * (confirmed present in cubism4.min.js).  When the event fires, the next
   * iteration is started via HeroModel.playMotion which now atomically clears
   * the queueManager._motions array before each startMotion call — so there
   * is no accumulation of stale entries and no progressive lag.
   *
   * Only ONE loop entry per model is ever active at a time.
   *
   * @param {string} modelId  - Model ID
   * @param {string} group    - Motion group name
   * @param {number} index    - Motion index within the group
   */
  public async playMotionLoop(modelId: string, group: string, index: number): Promise<boolean> {
    // Always replace any prior loop for this model
    this.stopMotionLoop(modelId);

    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ [Loop] Model not found:", modelId);
      return false;
    }

    const motionManager = heroModel.model?.internalModel?.motionManager;
    if (!motionManager) {
      this.logger.warn("⚠️ [Loop] motionManager not available:", modelId);
      return false;
    }

    this.logger.log(
      `🔁 [Loop] Starting native motion loop: ${modelId} → ${group}_${index}`,
    );

    // ── Native SDK Loop Strategy ─────────────────────────────────────────
    //
    // CubismSdkForWeb-5-r.4 source (cubismmotion.ts / acubismmotion.ts)
    // confirms that CubismMotion has a built-in `_isLoop` flag:
    //
    //   setIsLoop(loop: boolean)  /  isLoop(): boolean
    //
    // When `_isLoop === true`, `doUpdateParameters()` wraps time modulo the
    // motion duration and NEVER calls `motionQueueEntry.setIsFinished(true)`.
    // The motion runs indefinitely inside the SDK render loop — no external
    // event listeners, no stopAllMotions() per-iteration, no fallback timers.
    //
    // In cubism4.min.js the class is minified as `nt`.  The methods are
    // still named `setIsLoop` / `isLoop` (confirmed in minified source).
    //
    // The cached motion objects live in:
    //   motionManager.motionGroups[group][index]   (populated by loadMotion)
    //
    // Strategy:
    //   1. Call heroModel.playMotion() to start the motion (this also resets
    //      MotionState via stopAllMotions() so reserve() will pass).
    //   2. After playMotion resolves successfully, find the CubismMotion
    //      object from motionGroups[group][index] and call setIsLoop(true).
    //   3. To stop: call setIsLoop(false) on the motion object, then
    //      stopAllMotions() so the idle motion can resume normally.
    //
    // ─────────────────────────────────────────────────────────────────────

    // Step 1 — start the motion via the normal path
    const success = await heroModel.playMotion(group, index);
    if (!success) {
      this.logger.warn(
        `⚠️ [Loop] playMotion returned false for ${group}_${index}, cannot start loop`,
      );
      return false;
    }

    // Step 2 — enable native loop on the CubismMotion object
    const motionObj = motionManager.motionGroups?.[group]?.[index] as any;
    if (motionObj && typeof motionObj.setIsLoop === "function") {
      motionObj.setIsLoop(true);
      this.logger.log(
        `✅ [Loop] Native _isLoop=true set on CubismMotion ${group}_${index}`,
      );
    } else {
      // Fallback: motionGroups entry not yet populated (async load still in
      // flight) — try once after a short delay, then give up gracefully.
      this.logger.warn(
        `⚠️ [Loop] motionGroups[${group}][${index}] not ready yet, retrying in 150ms`,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      const motionObjRetry = motionManager.motionGroups?.[group]?.[index] as any;
      if (motionObjRetry && typeof motionObjRetry.setIsLoop === "function") {
        motionObjRetry.setIsLoop(true);
        this.logger.log(
          `✅ [Loop] Native _isLoop=true set on CubismMotion ${group}_${index} (retry)`,
        );
      } else {
        this.logger.warn(
          `⚠️ [Loop] Could not set native loop on ${group}_${index} — motionGroups entry missing`,
        );
        // Even without native loop the motion played once; treat as non-loop
        return false;
      }
    }

    // Register loop state so isLooping() / getLoopInfo() / stopMotionLoop() work
    this._loopState.set(modelId, { group, index, active: true });
    return true;
  }

  /**
   * Stop the motion loop for a model and clean up all listeners/timers.
   * @param {string} modelId - Model ID
   */
  public stopMotionLoop(modelId: string): void {
    const loopEntry = this._loopState.get(modelId);
    if (!loopEntry) return;

    loopEntry.active = false;
    this._loopState.delete(modelId);

    // Disable native SDK loop on the CubismMotion object so the motion
    // finishes naturally on the next cycle and the idle motion can resume.
    const heroModel = this.modelManager.getModel(modelId);
    if (heroModel) {
      const motionManager = heroModel.model?.internalModel?.motionManager;
      if (motionManager) {
        const motionObj =
          motionManager.motionGroups?.[loopEntry.group]?.[loopEntry.index] as any;
        if (motionObj && typeof motionObj.setIsLoop === "function") {
          motionObj.setIsLoop(false);
          this.logger.log(
            `⏹️ [Loop] Native _isLoop=false on ${loopEntry.group}_${loopEntry.index}`,
          );
        }
        // Stop immediately so the idle motion resumes without waiting for the
        // current cycle to finish (matches previous behaviour).
        motionManager.stopAllMotions();
      }
    }

    this.logger.log(`⏹️ [Loop] Motion loop stopped: ${modelId}`);
  }

  /**
   * Check whether a motion loop is currently active for a model.
   * @param {string} modelId - Model ID
   * @returns {boolean}
   */
  public isLooping(modelId: string): boolean {
    const state = this._loopState.get(modelId);
    return !!(state && state.active);
  }

  /**
   * Get the current loop info for a model, or null if not looping.
   * @param {string} modelId - Model ID
   * @returns {{ group: string, index: number } | null}
   */
  public getLoopInfo(modelId: string): { group: string; index: number } | null {
    const entry = this._loopState.get(modelId);
    if (!entry || !entry.active) return null;
    return { group: entry.group, index: entry.index };
  }

  // ── Standard Motion API ──────────────────────────────────────────────────

  /**
   * Play model motion
   * @param {string} modelId - Model ID
   * @param {string} group - Motion group name
   * @param {number} index - Motion index
   * @param {number} priority - Priority
   */
  public async playMotion(
    modelId: string,
    group: string,
    index: number,
    priority: number = 2,
  ): Promise<boolean> {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      // Limit motion priority in pet mode
      const adjustedPriority = this.isPetMode
        ? Math.min(priority, 1)
        : priority;

      // Starting a manual one-shot play stops any active loop
      this.stopMotionLoop(modelId);

      const result = await (heroModel.playMotion as any)(group, index, adjustedPriority);
      this.logger.log("🎭 Playing motion:", {
        modelId,
        group,
        index,
        priority: adjustedPriority,
        result,
      });

      // Automatically play associated audio if enabled
      if (result && this.audioEnabled) {
        this._playMotionAudio(heroModel, group, index);
      }

      return result;
    } catch (error) {
      this.logger.error("❌ Failed to play motion:", error);
      return false;
    }
  }

  /**
   * Play random motion
   * @param {string} modelId - Model ID
   * @param {string} group - Motion group name (optional)
   */
  public async playRandomMotion(modelId: string, group: string | null = null): Promise<boolean> {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      // Prefer idle motions in pet mode
      const targetGroup = this.isPetMode ? group || "idle" : group;

      const result = await heroModel.playRandomMotion(targetGroup || undefined);
      this.logger.log("🎲 Playing random motion:", {
        modelId,
        group: targetGroup,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error("❌ Failed to play random motion:", error);
      return false;
    }
  }

  /**
   * Set model expression
   * @param {string} modelId - Model ID
   * @param {number} expressionIndex - Expression index
   */
  public setExpression(modelId: string, expressionIndex: number): boolean {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      const result = heroModel.setExpression(expressionIndex);
      this.logger.log("😊 Set expression:", {
        modelId,
        expressionIndex,
      });
      return result;
    } catch (error) {
      this.logger.error("❌ Failed to set expression:", error);
      return false;
    }
  }

  /**
   * Play random expression
   * @param {string} modelId - Model ID
   */
  public playRandomExpression(modelId: string): boolean {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return false;
    }

    try {
      const result = heroModel.playRandomExpression();
      this.logger.log("🎲 Playing random expression:", {
        modelId,
        result,
      });
      return result;
    } catch (error) {
      this.logger.error("❌ Failed to play random expression:", error);
      return false;
    }
  }

  /**
   * Batch control expressions
   * @param {Array} expressions - Expression index array
   * @param {Array} modelIds - Target model ID array (optional, defaults to all models)
   */
  public batchControlExpressions(
    expressions: number[],
    modelIds: string[] | null = null,
  ): Array<{ modelId: string; expressionIndex: number; success: boolean }> {
    const targetIds = modelIds || this.modelManager.getAllModelIds();
    const results: Array<{ modelId: string; expressionIndex: number; success: boolean }> = [];

    targetIds.forEach((modelId) => {
      expressions.forEach((expressionIndex) => {
        const result = this.setExpression(modelId, expressionIndex);
        results.push({ modelId, expressionIndex, success: result });
      });
    });

    return results;
  }

  /**
   * Batch control motions
   * @param {Array} motions - Motion data array [{group, index, priority}]
   * @param {Array} modelIds - Target model ID array (optional, defaults to all models)
   */
  public async batchControlMotions(
    motions: Array<{ group: string; index: number; priority?: number }>,
    modelIds: string[] | null = null,
  ): Promise<Array<{ modelId: string; group: string; index: number; priority: number; success: boolean }>> {
    const targetIds = modelIds || this.modelManager.getAllModelIds();
    const results: Array<{ modelId: string; group: string; index: number; priority: number; success: boolean }> = [];

    for (const modelId of targetIds) {
      for (const motion of motions) {
        const { group, index, priority = 2 } = motion;
        const result = await this.playMotion(modelId, group, index, priority);
        results.push({ modelId, group, index, priority, success: result });
      }
    }

    return results;
  }

  /**
   * Set audio enabled state
   * @param {boolean} enabled - Whether to enable audio
   */
  public setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    this.logger.log(`🔊 Audio ${enabled ? "enabled" : "disabled"}`);

    // If disabling, stop any currently playing audio
    if (!enabled) {
      this.stopAudio();
    }
  }

  /**
   * Get audio enabled state
   * @returns {boolean}
   */
  public getAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  /**
   * Play audio associated with a specific motion
   * @param {HeroModel} heroModel - HeroModel instance
   * @param {string} group - Motion group name
   * @param {number} index - Motion index
   * @private
   */
  private _playMotionAudio(heroModel: HeroModel, group: string, index: number): void {
    try {
      if (!heroModel.getMotionAudioUrl) return;

      const audioUrl = heroModel.getMotionAudioUrl(group, index);
      if (audioUrl) {
        this.logger.log("🔊 Motion has audio, playing:", audioUrl);
        this.playAudio(audioUrl, { volume: this.audioVolume });
      }
    } catch (error) {
      this.logger.warn("⚠️ Failed to play motion audio:", error);
    }
  }

  /**
   * Play audio
   * @param {string} audioUrl - Audio URL
   * @param {Object} options - Playback options
   */
  public async playAudio(audioUrl: string, options: AudioOptions = {}): Promise<boolean> {
    // Do not play audio in pet mode
    if (this.isPetMode) {
      return false;
    }

    // Do not play audio if audio is disabled
    if (!this.audioEnabled) {
      return false;
    }

    try {
      // Stop currently playing audio
      this.stopAudio();

      // Create new audio player
      this.currentAudioPlayer = new Audio(audioUrl);

      // Set audio properties
      const { volume = 1.0, loop = false, playbackRate = 1.0 } = options;
      this.currentAudioPlayer.volume = volume;
      this.currentAudioPlayer.loop = loop;
      this.currentAudioPlayer.playbackRate = playbackRate;

      // Play audio
      await this.currentAudioPlayer.play();

      this.logger.log("🔊 Audio playback started:", audioUrl);

      // Listen for playback end event
      this.currentAudioPlayer.addEventListener("ended", () => {
        this.logger.log("🔇 Audio playback ended");
        this.currentAudioPlayer = null;
      });

      return true;
    } catch (error) {
      this.logger.error("❌ Audio playback failed:", error);
      this.currentAudioPlayer = null;
      return false;
    }
  }

  /**
   * Stop audio playback
   */
  public stopAudio(): void {
    if (this.currentAudioPlayer) {
      this.currentAudioPlayer.pause();
      this.currentAudioPlayer.currentTime = 0;
      this.currentAudioPlayer = null;
      this.logger.log("⏹️ Audio playback stopped");
    }
  }

  /**
   * Pause audio playback
   */
  public pauseAudio(): boolean {
    if (this.currentAudioPlayer && !this.currentAudioPlayer.paused) {
      this.currentAudioPlayer.pause();
      this.logger.log("⏸️ Audio playback paused");
      return true;
    }
    return false;
  }

  /**
   * Resume audio playback
   */
  public resumeAudio(): boolean {
    if (this.currentAudioPlayer && this.currentAudioPlayer.paused) {
      this.currentAudioPlayer.play().catch((err) => {
        this.logger.error("❌ Failed to resume audio:", err);
      });
      this.logger.log("▶️ Audio playback resumed");
      return true;
    }
    return false;
  }

  /**
   * Set audio volume
   * @param {number} volume - Volume (0.0 - 1.0)
   */
  public setAudioVolume(volume: number): boolean {
    this.audioVolume = volume;
    if (this.currentAudioPlayer) {
      this.currentAudioPlayer.volume = Math.max(0, Math.min(1, volume));
      this.logger.log("🔊 Volume set to:", volume);
      return true;
    }
    return false;
  }

  /**
   * Get audio playback status
   */
  public getAudioStatus(): AudioStatus {
    if (!this.currentAudioPlayer) {
      return { playing: false, paused: false, currentTime: 0, duration: 0 };
    }

    return {
      playing: !this.currentAudioPlayer.paused,
      paused: this.currentAudioPlayer.paused,
      currentTime: this.currentAudioPlayer.currentTime,
      duration: this.currentAudioPlayer.duration || 0,
      volume: this.currentAudioPlayer.volume,
    };
  }

  /**
   * Get model motion information
   * @param {string} modelId - Model ID
   */
  public getModelMotions(modelId: string): Record<string, any[]> | null {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return null;
    }

    try {
      return heroModel.getMotions();
    } catch (error) {
      this.logger.error("❌ Failed to get motion info:", error);
      return null;
    }
  }

  /**
   * Get model expression information
   * @param {string} modelId - Model ID
   */
  public getModelExpressions(modelId: string): any[] | null {
    const heroModel = this.modelManager.getModel(modelId);
    if (!heroModel) {
      this.logger.warn("⚠️ Model not found:", modelId);
      return null;
    }

    try {
      return heroModel.getExpressions();
    } catch (error) {
      this.logger.error("❌ Failed to get expression info:", error);
      return null;
    }
  }

  /**
   * Stop all animations
   */
  public stopAllAnimations(): void {
    // Stop all active loops first — snapshot keys to avoid mutation-during-iteration
    for (const modelId of Array.from(this._loopState.keys())) {
      this.stopMotionLoop(modelId);
    }

    this.modelManager.getAllModels().forEach((heroModel) => {
      try {
        if (heroModel.stopAllMotions) {
          heroModel.stopAllMotions();
        }
      } catch (error) {
        this.logger.error("❌ Failed to stop animation:", error);
      }
    });

    this.stopAudio();
    this.logger.log("⏹️ All animations stopped");
  }

  /**
   * Destroy animation manager
   */
  public destroy(): void {
    this.stopAllAnimations();
    this.animationQueue.clear();
    this.isPlaying.clear();
    this._loopState.clear();
    this.logger.log("🧹 Animation manager destroyed");
  }
}
