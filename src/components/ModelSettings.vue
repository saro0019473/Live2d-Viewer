<template>
    <n-card :bordered="false">
        <!-- 模型信息头部 -->
        <template #header>
            <n-space align="center">
                <n-button quaternary circle @click="goBack">
                    <template #icon>
                        <n-icon>
                            <svg viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"
                                />
                            </svg>
                        </n-icon>
                    </template>
                </n-button>

                <div>
                    <div style="font-size: 16px; font-weight: 600">
                        {{
                            getModelDisplayName(currentModel?.url) ||
                            "No Model Selected"
                        }}
                    </div>
                    <div
                        style="
                            font-size: 12px;
                            color: var(--n-text-color-disabled);
                        "
                    >
                        {{ currentModel?.url || "" }}
                    </div>
                </div>
            </n-space>
        </template>

        <template #header-extra>
            <n-space>
                <n-tag v-if="currentModel" type="success" size="small">
                    <template #icon>
                        <n-icon>
                            <svg viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
                                />
                            </svg>
                        </n-icon>
                    </template>
                    Loaded
                </n-tag>
            </n-space>
        </template>

        <n-spin :show="!currentModel || loading">
            <div v-if="currentModel">
                <n-scrollbar class="scrollable-content">
                    <!-- 使用折叠面板组织所有设置 -->
                    <n-collapse default-expanded-names="display">
                        <!-- Display Settings -->
                        <n-collapse-item
                            title="Display Settings"
                            name="display"
                        >
                            <template #header-extra>
                                <n-space>
                                    <n-tag size="small" type="primary"
                                        >Basic</n-tag
                                    >
                                    <n-icon
                                        size="16"
                                        color="var(--n-primary-color)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                                            />
                                        </svg>
                                    </n-icon>
                                </n-space>
                            </template>

                            <n-form
                                :model="modelSettings"
                                label-placement="left"
                                label-width="80"
                            >
                                <n-space vertical size="medium">
                                    <!-- Size Control -->
                                    <setting-slider
                                        label="Size"
                                        :model-value="modelSettings.scale"
                                        :min="0"
                                        :max="10"
                                        :step="0.01"
                                        :default-value="0.2"
                                        :show-min-max-input="false"
                                        :show-reset-button="true"
                                        :updater="
                                            (val) =>
                                                currentHeroModel?.setScale(val)
                                        "
                                        @update:model-value="
                                            (val) => (modelSettings.scale = val)
                                        "
                                        @reset="resetScale"
                                    />

                                    <!-- Rotation Control -->
                                    <setting-slider
                                        label="Rotation"
                                        :model-value="modelSettings.rotation"
                                        :min="0"
                                        :max="360"
                                        :step="1"
                                        :default-value="0"
                                        :show-min-max-input="false"
                                        :updater="
                                            (val) =>
                                                currentHeroModel?.setAngle(val)
                                        "
                                        @update:model-value="
                                            (val) =>
                                                (modelSettings.rotation = val)
                                        "
                                    />

                                    <n-divider style="margin: 8px 0" />

                                    <!-- Switch Controls -->
                                    <n-space vertical size="medium">
                                        <setting-switch
                                            label="Breathing Animation"
                                            :model-value="
                                                modelSettings.breathing
                                            "
                                            :updater="
                                                (val) =>
                                                    currentHeroModel?.setBreathing(
                                                        val,
                                                    )
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    (modelSettings.breathing =
                                                        val)
                                            "
                                        />

                                        <setting-switch
                                            label="Eye Blinking"
                                            :model-value="
                                                modelSettings.eyeBlinking
                                            "
                                            :updater="
                                                (val) =>
                                                    currentHeroModel?.setEyeBlinking(
                                                        val,
                                                    )
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    (modelSettings.eyeBlinking =
                                                        val)
                                            "
                                        />

                                        <setting-switch
                                            label="Model Dragging"
                                            :model-value="
                                                modelSettings.interactive
                                            "
                                            :updater="
                                                (val) =>
                                                    currentHeroModel?.setInteractive(
                                                        val,
                                                    )
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    (modelSettings.interactive =
                                                        val)
                                            "
                                        />

                                        <!-- Audio Playback Switch -->
                                        <setting-switch
                                            label="Audio Playback"
                                            :model-value="
                                                modelSettings.enableAudio
                                            "
                                            :updater="
                                                (val) => {
                                                    if (
                                                        currentHeroModel?.model
                                                    ) {
                                                        currentHeroModel.model.audioEnabled =
                                                            val;
                                                    }
                                                }
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    (modelSettings.enableAudio =
                                                        val)
                                            "
                                        />

                                        <!-- Text Display Switch -->
                                        <setting-switch
                                            label="Text Display"
                                            :model-value="
                                                modelSettings.showText
                                            "
                                            :updater="
                                                (val) => {
                                                    if (
                                                        currentHeroModel?.model
                                                    ) {
                                                        currentHeroModel.model.textEnabled =
                                                            val;
                                                    }
                                                }
                                            "
                                            @update:model-value="
                                                (val) =>
                                                    (modelSettings.showText =
                                                        val)
                                            "
                                        />
                                    </n-space>

                                    <n-divider style="margin: 16px 0" />

                                    <!-- Interaction Controls -->
                                    <n-space vertical size="medium">
                                        <div
                                            style="
                                                font-size: 14px;
                                                font-weight: 500;
                                                color: var(--n-text-color-base);
                                            "
                                        >
                                            Interaction
                                        </div>

                                        <setting-switch
                                            label="Wheel Zoom"
                                            :model-value="
                                                modelSettings.wheelZoom
                                            "
                                            @update:model-value="
                                                (value) => {
                                                    modelSettings.wheelZoom =
                                                        value;
                                                    updateWheelZoom();
                                                }
                                            "
                                        />

                                        <setting-switch
                                            label="Mouse Interaction"
                                            :model-value="
                                                modelSettings.clickInteraction
                                            "
                                            @update:model-value="
                                                (value) => {
                                                    modelSettings.clickInteraction =
                                                        value;
                                                    updateClickInteraction();
                                                }
                                            "
                                        />

                                        <!-- Zoom Settings -->
                                        <div
                                            v-if="modelSettings.wheelZoom"
                                            style="margin-top: 12px"
                                        >
                                            <n-space vertical size="small">
                                                <div
                                                    style="
                                                        font-size: 13px;
                                                        color: var(
                                                            --n-text-color-disabled
                                                        );
                                                    "
                                                >
                                                    Zoom Settings
                                                </div>

                                                <n-form-item
                                                    label="Zoom Speed"
                                                    label-placement="left"
                                                    style="margin: 0"
                                                >
                                                    <n-slider
                                                        :value="
                                                            modelSettings.zoomSpeed
                                                        "
                                                        :min="0.01"
                                                        :max="0.1"
                                                        :step="0.01"
                                                        @update:value="
                                                            (value) => {
                                                                modelSettings.zoomSpeed =
                                                                    value;
                                                                updateZoomSettings();
                                                            }
                                                        "
                                                        style="
                                                            flex: 1;
                                                            margin-right: 12px;
                                                        "
                                                    />
                                                    <n-input-number
                                                        :value="
                                                            modelSettings.zoomSpeed
                                                        "
                                                        :min="0.01"
                                                        :max="0.1"
                                                        :step="0.01"
                                                        size="small"
                                                        @update:value="
                                                            (value) => {
                                                                modelSettings.zoomSpeed =
                                                                    value;
                                                                updateZoomSettings();
                                                            }
                                                        "
                                                        style="width: 80px"
                                                    />
                                                </n-form-item>

                                                <n-form-item
                                                    label="Min Scale"
                                                    label-placement="left"
                                                    style="margin: 0"
                                                >
                                                    <n-slider
                                                        :value="
                                                            modelSettings.minScale
                                                        "
                                                        :min="0.01"
                                                        :max="1.0"
                                                        :step="0.01"
                                                        @update:value="
                                                            (value) => {
                                                                modelSettings.minScale =
                                                                    value;
                                                                updateZoomSettings();
                                                            }
                                                        "
                                                        style="
                                                            flex: 1;
                                                            margin-right: 12px;
                                                        "
                                                    />
                                                    <n-input-number
                                                        :value="
                                                            modelSettings.minScale
                                                        "
                                                        :min="0.01"
                                                        :max="1.0"
                                                        :step="0.1"
                                                        size="small"
                                                        @update:value="
                                                            (value) => {
                                                                modelSettings.minScale =
                                                                    value;
                                                                updateZoomSettings();
                                                            }
                                                        "
                                                        style="width: 80px"
                                                    />
                                                </n-form-item>

                                                <n-form-item
                                                    label="Max Scale"
                                                    label-placement="left"
                                                    style="margin: 0"
                                                >
                                                    <n-slider
                                                        :value="
                                                            modelSettings.maxScale
                                                        "
                                                        :min="1.0"
                                                        :max="5.0"
                                                        :step="0.1"
                                                        @update:value="
                                                            (value) => {
                                                                modelSettings.maxScale =
                                                                    value;
                                                                updateZoomSettings();
                                                            }
                                                        "
                                                        style="
                                                            flex: 1;
                                                            margin-right: 12px;
                                                        "
                                                    />
                                                    <n-input-number
                                                        :value="
                                                            modelSettings.maxScale
                                                        "
                                                        :min="1.0"
                                                        :max="5.0"
                                                        :step="0.1"
                                                        size="small"
                                                        @update:value="
                                                            (value) => {
                                                                modelSettings.maxScale =
                                                                    value;
                                                                updateZoomSettings();
                                                            }
                                                        "
                                                        style="width: 80px"
                                                    />
                                                </n-form-item>
                                            </n-space>
                                        </div>
                                    </n-space>
                                </n-space>
                            </n-form>
                        </n-collapse-item>

                        <!-- Expression Control -->
                        <n-collapse-item
                            title="Expression Control"
                            name="expressions"
                        >
                            <template #header-extra>
                                <n-space>
                                    <n-tag size="small" type="warning">{{
                                        expressions.length
                                    }}</n-tag>
                                    <n-icon
                                        size="16"
                                        color="var(--n-warning-color)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
                                            />
                                        </svg>
                                    </n-icon>
                                </n-space>
                            </template>

                            <div
                                v-if="expressions.length > 0"
                                style="max-height: 300px; overflow-y: auto"
                            >
                                <n-list hoverable clickable>
                                    <n-list-item
                                        v-for="(
                                            expression, index
                                        ) in expressions"
                                        :key="index"
                                        @click="setExpression(index)"
                                    >
                                        <template #prefix>
                                            <n-icon
                                                color="var(--n-warning-color)"
                                            >
                                                <svg viewBox="0 0 24 24">
                                                    <path
                                                        fill="currentColor"
                                                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                                                    />
                                                </svg>
                                            </n-icon>
                                        </template>
                                        {{
                                            expression.Name ||
                                            `Expression ${index + 1}`
                                        }}
                                    </n-list-item>
                                </n-list>
                            </div>

                            <n-empty
                                v-else
                                description="No expression data available"
                                size="small"
                            >
                                <template #icon>
                                    <n-icon
                                        size="32"
                                        color="var(--n-text-color-disabled)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c.93 0 1.69.76 1.69 1.69S12.93 8.38 12 8.38s-1.69-.76-1.69-1.69S11.07 5 12 5zm0 9.38c-2.03 0-3.78-.92-4.97-2.34.03-.31.17-.6.43-.82.26-.22.6-.34.96-.34h7.16c.36 0 .7.12.96.34.26.22.4.51.43.82-1.19 1.42-2.94 2.34-4.97 2.34z"
                                            />
                                        </svg>
                                    </n-icon>
                                </template>
                            </n-empty>
                        </n-collapse-item>

                        <!-- Motion Control -->
                        <n-collapse-item
                            title="Motion Control"
                            name="motions"
                            class="motion-control-collapse"
                        >
                            <template #header-extra>
                                <n-space>
                                    <n-tag size="small" type="success"
                                        >{{
                                            Object.keys(motions).length
                                        }}
                                        groups</n-tag
                                    >
                                    <n-button
                                        size="tiny"
                                        type="primary"
                                        @click.stop="playRandomMotion"
                                        :disabled="
                                            Object.keys(motions).length === 0
                                        "
                                        style="margin-left: 8px"
                                    >
                                        Random Play
                                    </n-button>
                                    <n-button
                                        size="tiny"
                                        type="error"
                                        @click.stop="stopCurrentMotion"
                                        :disabled="!isMotionPlaying"
                                        style="margin-left: 4px"
                                    >
                                        Stop
                                    </n-button>
                                    <n-icon
                                        size="16"
                                        color="var(--n-success-color)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M8 5v14l11-7z"
                                            />
                                        </svg>
                                    </n-icon>
                                </n-space>
                            </template>

                            <div
                                v-if="Object.keys(motions).length > 0"
                                style="max-height: 600px; overflow-y: auto"
                            >
                                <!-- Current Playback Status -->
                                <div
                                    v-if="currentPlayingMotion"
                                    style="
                                        margin-bottom: 16px;
                                        padding: 12px;
                                        background: var(--n-info-color-suppl);
                                        border-radius: 6px;
                                    "
                                >
                                    <n-space
                                        align="center"
                                        justify="space-between"
                                    >
                                        <div>
                                            <div
                                                style="
                                                    font-size: 13px;
                                                    font-weight: 500;
                                                    color: var(--n-info-color);
                                                "
                                            >
                                                Playing:
                                                {{ currentPlayingMotion.name }}
                                            </div>
                                            <div
                                                style="
                                                    font-size: 11px;
                                                    color: var(
                                                        --n-text-color-disabled
                                                    );
                                                "
                                            >
                                                {{ currentPlayingMotion.group }}
                                                -
                                                {{
                                                    currentPlayingMotion.index +
                                                    1
                                                }}
                                            </div>
                                        </div>
                                        <n-button
                                            size="small"
                                            type="error"
                                            @click="stopCurrentMotion"
                                        >
                                            Stop
                                        </n-button>
                                    </n-space>
                                </div>

                                <n-collapse>
                                    <n-collapse-item
                                        v-for="(
                                            motionGroup, groupName
                                        ) in motions"
                                        :key="groupName"
                                        :title="groupName"
                                        :name="groupName"
                                    >
                                        <template #header-extra>
                                            <n-space>
                                                <n-tag
                                                    size="tiny"
                                                    type="info"
                                                    >{{
                                                        motionGroup.length
                                                    }}</n-tag
                                                >
                                                <n-button
                                                    size="tiny"
                                                    type="primary"
                                                    @click.stop="
                                                        playRandomMotionFromGroup(
                                                            groupName,
                                                        )
                                                    "
                                                    style="margin-left: 4px"
                                                >
                                                    Random
                                                </n-button>
                                            </n-space>
                                        </template>

                                        <n-list hoverable clickable>
                                            <n-list-item
                                                v-for="(
                                                    motion, index
                                                ) in motionGroup"
                                                :key="`${groupName}-${index}`"
                                                @click="
                                                    playMotion(
                                                        groupName,
                                                        index,
                                                        motion,
                                                    )
                                                "
                                                :class="{
                                                    'motion-playing':
                                                        isCurrentMotion(
                                                            groupName,
                                                            index,
                                                        ),
                                                }"
                                            >
                                                <template #prefix>
                                                    <n-icon
                                                        :color="
                                                            isCurrentMotion(
                                                                groupName,
                                                                index,
                                                            )
                                                                ? 'var(--n-warning-color)'
                                                                : 'var(--n-success-color)'
                                                        "
                                                        :size="
                                                            isCurrentMotion(
                                                                groupName,
                                                                index,
                                                            )
                                                                ? 18
                                                                : 16
                                                        "
                                                    >
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            v-if="
                                                                !isCurrentMotion(
                                                                    groupName,
                                                                    index,
                                                                )
                                                            "
                                                        >
                                                            <path
                                                                fill="currentColor"
                                                                d="M8 5v14l11-7z"
                                                            />
                                                        </svg>
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            v-else
                                                        >
                                                            <path
                                                                fill="currentColor"
                                                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                                                            />
                                                        </svg>
                                                    </n-icon>
                                                </template>

                                                <n-space
                                                    justify="space-between"
                                                    align="center"
                                                    style="width: 100%"
                                                >
                                                    <div>
                                                        <div
                                                            style="
                                                                font-size: 13px;
                                                            "
                                                        >
                                                            {{
                                                                getMotionDisplayName(
                                                                    motion,
                                                                    index,
                                                                )
                                                            }}
                                                        </div>
                                                        <div
                                                            v-if="motion.Text"
                                                            style="
                                                                font-size: 11px;
                                                                color: var(
                                                                    --n-text-color-disabled
                                                                );
                                                                margin-top: 2px;
                                                            "
                                                        >
                                                            {{
                                                                motion.Text.substring(
                                                                    0,
                                                                    30,
                                                                )
                                                            }}{{
                                                                motion.Text
                                                                    .length > 30
                                                                    ? "..."
                                                                    : ""
                                                            }}
                                                        </div>
                                                    </div>

                                                    <n-space size="small">
                                                        <n-tag
                                                            v-if="motion.Audio"
                                                            size="tiny"
                                                            type="warning"
                                                        >
                                                            Audio
                                                        </n-tag>
                                                        <n-tag
                                                            v-if="motion.Text"
                                                            size="tiny"
                                                            type="info"
                                                        >
                                                            Text
                                                        </n-tag>
                                                    </n-space>
                                                </n-space>
                                            </n-list-item>
                                        </n-list>
                                    </n-collapse-item>
                                </n-collapse>
                            </div>

                            <n-empty
                                v-else
                                description="No motion data available"
                                size="small"
                            >
                                <template #icon>
                                    <n-icon
                                        size="32"
                                        color="var(--n-text-color-disabled)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M8 5v14l11-7z"
                                            />
                                        </svg>
                                    </n-icon>
                                </template>
                            </n-empty>
                        </n-collapse-item>

                        <!-- Parameter Control -->
                        <n-collapse-item
                            title="Parameter Control"
                            name="parameters"
                        >
                            <template #header-extra>
                                <n-space>
                                    <n-tag size="small" type="info">{{
                                        parameters.length
                                    }}</n-tag>
                                    <n-icon
                                        size="16"
                                        color="var(--n-info-color)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"
                                            />
                                        </svg>
                                    </n-icon>
                                </n-space>
                            </template>

                            <div
                                v-if="parameters.length > 0"
                                style="max-height: 600px; overflow-y: auto"
                            >
                                <n-space vertical size="medium">
                                    <div
                                        v-for="param in parameters"
                                        :key="param.parameterIds"
                                        style="
                                            padding: 12px;
                                            border: 1px solid
                                                var(--n-border-color);
                                            border-radius: 6px;
                                        "
                                    >
                                        <setting-slider
                                            :label="param.parameterIds"
                                            :model-value="
                                                currentParameters[
                                                    param.parameterIds
                                                ] ?? param.defaultValue
                                            "
                                            :min="param.min"
                                            :max="param.max"
                                            :step="0.01"
                                            :updater="
                                                (value) =>
                                                    currentHeroModel?.setParameters(
                                                        param.parameterIds,
                                                        value,
                                                    )
                                            "
                                            @update:model-value="
                                                (value) =>
                                                    (currentParameters[
                                                        param.parameterIds
                                                    ] = value)
                                            "
                                            :form-item-style="{ margin: '0' }"
                                            :slider-style="{ margin: '8px 0' }"
                                            :input-number-style="{
                                                width: '80px',
                                            }"
                                            space-size="small"
                                        />
                                    </div>
                                </n-space>
                            </div>

                            <n-empty
                                v-else
                                description="No parameter data available"
                                size="small"
                            >
                                <template #icon>
                                    <n-icon
                                        size="32"
                                        color="var(--n-text-color-disabled)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"
                                            />
                                        </svg>
                                    </n-icon>
                                </template>
                            </n-empty>
                        </n-collapse-item>

                        <!-- Part Control -->
                        <n-collapse-item title="Part Control" name="parts">
                            <template #header-extra>
                                <n-space>
                                    <n-tag size="small" type="error">{{
                                        partOpacity.length
                                    }}</n-tag>
                                    <n-icon
                                        size="16"
                                        color="var(--n-error-color)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                            />
                                        </svg>
                                    </n-icon>
                                </n-space>
                            </template>

                            <div
                                v-if="partOpacity.length > 0"
                                style="max-height: 600px; overflow-y: auto"
                            >
                                <n-space vertical size="medium">
                                    <div
                                        v-for="part in partOpacity"
                                        :key="part.partId"
                                        style="
                                            padding: 12px;
                                            border: 1px solid
                                                var(--n-border-color);
                                            border-radius: 6px;
                                        "
                                    >
                                        <setting-slider
                                            :label="part.partId"
                                            :model-value="
                                                currentParts[part.partId] ??
                                                part.defaultValue
                                            "
                                            :min="0"
                                            :max="1"
                                            :step="0.1"
                                            :updater="
                                                (value) =>
                                                    currentHeroModel?.setPartOpacity(
                                                        part.partId,
                                                        value,
                                                    )
                                            "
                                            @update:model-value="
                                                (value) =>
                                                    (currentParts[part.partId] =
                                                        value)
                                            "
                                            :form-item-style="{ margin: '0' }"
                                            :slider-style="{ margin: '8px 0' }"
                                            :input-number-style="{
                                                width: '80px',
                                            }"
                                            space-size="small"
                                        />
                                    </div>
                                </n-space>
                            </div>

                            <n-empty
                                v-else
                                description="No part data available"
                                size="small"
                            >
                                <template #icon>
                                    <n-icon
                                        size="32"
                                        color="var(--n-text-color-disabled)"
                                    >
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                            />
                                        </svg>
                                    </n-icon>
                                </template>
                            </n-empty>
                        </n-collapse-item>
                    </n-collapse>
                </n-scrollbar>
            </div>

            <template #action>
                <n-space justify="center">
                    <n-button @click="goBack">
                        <template #icon>
                            <n-icon>
                                <svg viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"
                                    />
                                </svg>
                            </n-icon>
                        </template>
                        Back
                    </n-button>
                </n-space>
            </template>
        </n-spin>
    </n-card>
</template>

<script>
import {
    ref,
    reactive,
    computed,
    watch,
    nextTick,
    onMounted,
    onUnmounted,
} from "vue";
import { useMessage } from "naive-ui";
import { useLive2DStore } from "../stores/live2d";
import { globalStateSyncManager } from "../utils/live2d/state-sync-manager.js";
import { globalResourceManager } from "../utils/resource-manager.js";
import SettingSlider from "./settings/SettingSlider.vue";
import SettingSwitch from "./settings/SettingSwitch.vue";

export default {
    name: "ModelSettings",
    components: {
        SettingSlider,
        SettingSwitch,
    },
    emits: ["back"],
    setup(_, { emit }) {
        const live2dStore = useLive2DStore();
        const message = useMessage();

        // State management
        const loading = ref(false);

        // Settings sync control
        const settingsSyncEnabled = ref(true);
        const isLoadingFromStore = ref(false);
        const syncDebounceTimer = ref(null);

        // State sync manager integration
        const stateSyncEnabled = ref(true);
        const lastSyncTime = ref(0);
        const syncInterval = 100; // 100ms同步间隔

        // Motion playback state management
        const isMotionPlaying = ref(false);
        const currentPlayingMotion = ref(null);

        // Extended state management
        const currentExpression = ref(null);
        const currentParameters = reactive({});
        const currentParts = reactive({});
        const currentAudioState = ref(false);
        const currentTextState = ref(false);

        const modelSettings = reactive({
            scale: 0.2,
            rotation: 0,
            breathing: true,
            eyeBlinking: true,
            interactive: true,
            // 交互功能设置
            wheelZoom: true,
            clickInteraction: true,
            // 缩放设置
            zoomSpeed: 0.01,
            minScale: 0.01,
            maxScale: 5.0,
            // 新增
            enableAudio: true,
            showText: true,
        });

        // Computed properties
        const currentModel = computed(() => live2dStore.currentModel);

        // Get current heroModel instance
        const currentHeroModel = computed(() => {
            const manager = live2dStore?.manager;
            const currentModelValue = currentModel.value;

            // 1. Ensure manager and currentModelValue are both ready
            if (!manager || !currentModelValue || !currentModelValue.id) {
                // console.log('🔍 [ModelSettings] Manager or currentModel is not ready.');
                return null;
            }

            // 2. Ensure model is fully loaded
            if (live2dStore.isLoading) {
                // console.log(`🔍 [ModelSettings] Store is loading, model might not be fully ready.`);
                return null;
            }

            // 3. Ensure model actually exists in manager
            const heroModel = manager.getModel(currentModelValue.id);
            if (!heroModel) {
                // console.log(`🔍 [ModelSettings] HeroModel with id ${currentModelValue.id} not found in manager.`);
                return null;
            }

            console.log(
                `[ModelSettings] currentHeroModel resolved for id ${currentModelValue.id}.`,
            );
            return heroModel;
        });

        // Get expression data from heroModel
        const expressions = computed(() => {
            if (!currentHeroModel.value) {
                console.log(
                    "🔍 [ModelSettings] expressions: currentHeroModel is null.",
                );
                return [];
            }
            try {
                const exprs = currentHeroModel.value.getExpressions() || [];
                console.log(
                    "🔍 [ModelSettings] expressions computed:",
                    exprs.length,
                    "items",
                );
                return exprs;
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to get expression data:",
                    error,
                );
                return [];
            }
        });

        // Get motion data from heroModel
        const motions = computed(() => {
            if (!currentHeroModel.value) {
                console.log(
                    "🔍 [ModelSettings] motions: currentHeroModel is null.",
                );
                return {};
            }
            try {
                const mots = currentHeroModel.value.getMotions() || {};
                console.log(
                    "🔍 [ModelSettings] motions computed:",
                    Object.keys(mots).length,
                    "groups",
                );
                return mots;
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to get motion data:",
                    error,
                );
                return {};
            }
        });

        // Get parameter data from heroModel
        const parameters = computed(() => {
            if (!currentHeroModel.value) {
                console.log(
                    "🔍 [ModelSettings] parameters: currentHeroModel is null.",
                );
                return [];
            }
            try {
                const modelParams =
                    currentHeroModel.value.getAllParameters() || [];
                console.log(
                    "🔍 [ModelSettings] parameters computed:",
                    modelParams.length,
                    "items",
                );
                return modelParams;
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to get parameter data:",
                    error,
                );
                return [];
            }
        });

        // Get part opacity data from heroModel
        const partOpacity = computed(() => {
            if (!currentHeroModel.value) {
                console.log(
                    "🔍 [ModelSettings] partOpacity: currentHeroModel is null.",
                );
                return [];
            }
            try {
                const modelParts =
                    currentHeroModel.value.getAllPartOpacity() || [];
                console.log(
                    "🔍 [ModelSettings] partOpacity computed:",
                    modelParts.length,
                    "items.",
                );
                return modelParts;
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to get part data:",
                    error,
                );
                return [];
            }
        });

        // Resource cleanup function
        const cleanupResources = () => {
            // Cleanup timers - use resource manager
            if (syncDebounceTimer.value) {
                globalResourceManager.cleanupTimers();
                syncDebounceTimer.value = null;
            }
            console.log("🧹 [ModelSettings] Resource cleanup completed");
        };
        // Settings sync methods
        const syncSettingsToStore = () => {
            if (isLoadingFromStore.value) return; // Don't write while loading, prevent loops
            if (!live2dStore || isLoadingFromStore.value) return;

            try {
                // Lock before writing to Store to prevent watch triggers
                isLoadingFromStore.value = true;

                const currentSettings = {
                    scale: modelSettings.scale,
                    rotation: modelSettings.rotation,
                    breathing: modelSettings.breathing,
                    eyeBlinking: modelSettings.eyeBlinking,
                    interactive: modelSettings.interactive,
                    wheelZoom: modelSettings.wheelZoom,
                    clickInteraction: modelSettings.clickInteraction,
                    zoomSettings: {
                        speed: modelSettings.zoomSpeed,
                        min: modelSettings.minScale,
                        max: modelSettings.maxScale,
                    },
                    enableAudio: modelSettings.enableAudio,
                    showText: modelSettings.showText,
                    expression: currentExpression.value,
                    motion: currentPlayingMotion.value,
                    parameters: { ...currentParameters },
                    parts: { ...currentParts },
                };

                // Use updateModelState uniformly to update all settings
                if (
                    live2dStore &&
                    typeof live2dStore.updateModelState === "function"
                ) {
                    live2dStore.updateModelState(currentSettings);
                }

                console.log("💾 [ModelSettings] Settings synced to Store:", {
                    ...modelSettings,
                });
            } finally {
                // Delayed unlock to ensure Store update completes before allowing watch
                setTimeout(() => {
                    isLoadingFromStore.value = false;
                }, 10);
            }
        };

        // Safe method to load settings from Store
        const loadSettingsFromStore = () => {
            if (isLoadingFromStore.value) return; // Don't load while writing

            isLoadingFromStore.value = true;
            try {
                if (!currentModel.value || !live2dStore.modelState?.settings) {
                    console.log(
                        "📝 [ModelSettings] No settings data in Store, using defaults",
                    );
                    return;
                }

                const settings = live2dStore.modelState.settings;

                // Unified handling of basic and extended settings
                const applySetting = (
                    key,
                    target,
                    source,
                    defaultValue = undefined,
                ) => {
                    if (source[key] !== undefined) {
                        target[key] = source[key];
                    } else if (defaultValue !== undefined) {
                        target[key] = defaultValue;
                    }
                };

                // Basic settings
                applySetting("scale", modelSettings, settings);
                applySetting("rotation", modelSettings, settings);
                applySetting("breathing", modelSettings, settings);
                applySetting("eyeBlinking", modelSettings, settings);
                applySetting("interactive", modelSettings, settings);

                // Interaction settings
                applySetting("wheelZoom", modelSettings, settings);
                applySetting("clickInteraction", modelSettings, settings);

                // Zoom settings - fix data structure matching
                if (settings.zoomSettings) {
                    applySetting(
                        "speed",
                        modelSettings,
                        settings.zoomSettings,
                        modelSettings.zoomSpeed,
                    );
                    applySetting(
                        "min",
                        modelSettings,
                        settings.zoomSettings,
                        modelSettings.minScale,
                    );
                    applySetting(
                        "max",
                        modelSettings,
                        settings.zoomSettings,
                        modelSettings.maxScale,
                    );
                } else {
                    // Compatible with old format
                    applySetting("zoomSpeed", modelSettings, settings);
                    applySetting("minScale", modelSettings, settings);
                    applySetting("maxScale", modelSettings, settings);
                }

                // Extended settings
                applySetting("enableAudio", modelSettings, settings);
                applySetting("showText", modelSettings, settings);

                // Extended state
                applySetting("expression", currentExpression, settings, null);
                applySetting("motion", currentPlayingMotion, settings, null);
                if (settings.parameters !== undefined) {
                    // Clear existing parameters
                    for (const key in currentParameters) {
                        delete currentParameters[key];
                    }
                    // Copy new parameters
                    Object.assign(currentParameters, settings.parameters);
                }
                if (settings.parts !== undefined) {
                    // Clear existing parts
                    for (const key in currentParts) {
                        delete currentParts[key];
                    }
                    // Copy new parts
                    Object.assign(currentParts, settings.parts);
                }
                applySetting("audio", currentAudioState, settings, false);
                applySetting("text", currentTextState, settings, false);

                console.log("✅ [ModelSettings] Settings loaded from Store");
            } finally {
                isLoadingFromStore.value = false;
            }
        };

        // Function to sync all model states to UI
        const syncAllModelStatesToUI = () => {
            if (!currentHeroModel.value) return;

            console.log(
                "🔄 [ModelSettings] Starting full state sync from model to UI.",
            );

            try {
                // 1. Sync basic transform properties
                const scale = currentHeroModel.value.getScale();
                if (scale && typeof scale.x === "number")
                    modelSettings.scale = scale.x;

                const rotation = currentHeroModel.value.getAngle();
                if (typeof rotation === "number")
                    modelSettings.rotation = rotation;

                // 2. Sync boolean states
                if (currentHeroModel.value.model) {
                    modelSettings.breathing =
                        currentHeroModel.value.model.breathing;
                    modelSettings.eyeBlinking =
                        currentHeroModel.value.model.eyeBlinking;
                    modelSettings.interactive =
                        currentHeroModel.value.model.interactive;
                }

                // 3. Sync expressions
                const expressionIndex =
                    currentHeroModel.value.getCurrentExpressionIndex();
                currentExpression.value = expressionIndex;

                // 4. Sync motions
                const motionManager =
                    currentHeroModel.value.model?.internalModel?.motionManager;
                if (motionManager && motionManager.currentMotion) {
                    const currentMotion = motionManager.currentMotion;
                    currentPlayingMotion.value = {
                        group: currentMotion.group,
                        index: currentMotion.index,
                        isPlaying: true,
                        name:
                            currentMotion.name ||
                            `${currentMotion.group}_${currentMotion.index}`,
                    };
                    isMotionPlaying.value = true;
                } else {
                    currentPlayingMotion.value = null;
                    isMotionPlaying.value = false;
                }

                // 5. Sync parameters
                const params = currentHeroModel.value.getAllParameters() || [];
                for (const key in currentParameters)
                    delete currentParameters[key];
                params.forEach((p) => {
                    currentParameters[p.parameterIds] = p.defaultValue;
                });

                // 6. Sync part opacity
                const parts = currentHeroModel.value.getAllPartOpacity() || [];
                for (const key in currentParts) delete currentParts[key];
                parts.forEach((p) => {
                    currentParts[p.partId] = p.defaultValue;
                });

                // 7. Sync audio and text state
                modelSettings.enableAudio =
                    currentHeroModel.value.model.audioEnabled !== false;
                modelSettings.showText =
                    currentHeroModel.value.model.textEnabled !== false;
                currentAudioState.value = modelSettings.enableAudio;
                currentTextState.value = modelSettings.showText;

                // 8. Sync interaction settings
                updateZoomSettings();

                console.log("✅ [ModelSettings] Full state sync completed.");
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to sync model state:",
                    error,
                );
                message.error("Failed to sync model state");
            }
        };

        // Watch model changes
        watch(
            currentModel,
            async (newModel, oldModel) => {
                if (newModel && newModel.id !== oldModel?.id) {
                    console.log(
                        "🔄 [ModelSettings] Model changed, reloading settings:",
                        newModel.id,
                    );

                    // Unregister old model state sync
                    if (oldModel) {
                        unregisterStateSync();
                    }

                    // Cleanup previous model resources
                    cleanupResources();

                    // Temporarily disable sync to avoid duplicate triggers
                    settingsSyncEnabled.value = false;
                    stateSyncEnabled.value = false;

                    // Reset basic settings to defaults
                    Object.assign(modelSettings, {
                        scale: 0.2,
                        rotation: 0,
                        breathing: true,
                        eyeBlinking: true,
                        interactive: true,
                        // Interaction settings
                        wheelZoom: true,
                        clickInteraction: true,
                        // Zoom settings
                        zoomSpeed: 0.01,
                        minScale: 0.05,
                        maxScale: 2.0,
                        // Audio/text
                        enableAudio: true,
                        showText: true,
                    });

                    // Reset extended state
                    currentExpression.value = null;
                    currentPlayingMotion.value = null;
                    for (const key in currentParameters) {
                        delete currentParameters[key];
                    }
                    for (const key in currentParts) {
                        delete currentParts[key];
                    }
                    currentAudioState.value = false;
                    currentTextState.value = false;
                    isMotionPlaying.value = false;

                    // Delay loading data to improve performance
                    await nextTick();

                    // Try to load settings from Store
                    loadSettingsFromStore();

                    // Try to restore state from state sync manager
                    if (newModel && currentHeroModel.value) {
                        const restored =
                            globalStateSyncManager.restoreStateFromCache(
                                newModel.id,
                                currentHeroModel.value,
                            );
                        if (restored) {
                            console.log(
                                "✅ [ModelSettings] State restored from state sync manager",
                            );
                        }
                    }

                    // Re-enable sync
                    settingsSyncEnabled.value = true;
                    stateSyncEnabled.value = true;

                    // Register new model state sync
                    await nextTick();
                    registerStateSync();

                    // Sync current model state
                    syncAllModelStatesToUI();
                }
            },
            { immediate: true },
        );

        // Watch modelState changes in Store
        watch(
            () => live2dStore.modelState,
            (newState) => {
                if (
                    newState &&
                    newState.settings &&
                    !isLoadingFromStore.value
                ) {
                    console.log(
                        "🔄 [ModelSettings] Store state changed, reloading settings",
                    );
                    loadSettingsFromStore();
                }
            },
            { deep: true },
        );

        // Watch heroModel changes to ensure data sync
        watch(
            currentHeroModel,
            (newHeroModel) => {
                if (newHeroModel) {
                    console.log(
                        "🦸‍♂️ [ModelSettings] HeroModel ready, performing full sync",
                    );
                    // On first load, currentModel's watch callback calls syncAllModelStatesToUI
                    // No need to call again here to avoid redundant sync operations
                }
            },
            { immediate: true },
        );

        // Watch motion playback state changes
        watch(isMotionPlaying, (newValue) => {
            if (newValue && currentPlayingMotion.value) {
                console.log(
                    "🎬 [ModelSettings] Motion started playing:",
                    currentPlayingMotion.value,
                );
            } else if (!newValue) {
                console.log("⏹️ [ModelSettings] Motion stopped");
            }
        });

        // Watch expression changes
        watch(currentExpression, (newExpression) => {
            if (newExpression !== null) {
                console.log(
                    "😊 [ModelSettings] Expression set:",
                    newExpression,
                );
                syncSettingsToStore();
            }
        });

        // Watch parameter changes
        watch(
            currentParameters,
            (newParameters) => {
                console.log(
                    "🔧 [ModelSettings] Parameters updated:",
                    newParameters,
                );
                syncSettingsToStore();
            },
            { deep: true },
        );

        // Watch part changes
        watch(
            currentParts,
            (newParts) => {
                console.log("🎨 [ModelSettings] Parts updated:", newParts);
                syncSettingsToStore();
            },
            { deep: true },
        );

        // Watch audio and text state changes
        watch([currentAudioState, currentTextState], ([newAudio, newText]) => {
            console.log("🔊 [ModelSettings] Audio/text state updated:", {
                audio: newAudio,
                text: newText,
            });
            syncSettingsToStore();
        });

        const setExpression = (index) => {
            if (!currentHeroModel.value || !expressions.value[index]) return;

            const expression = expressions.value[index];
            currentHeroModel.value.setExpression(index);
            currentExpression.value = index;

            message.success(
                `Expression set: ${expression.Name || `Expression ${index + 1}`}`,
            );
            syncSettingsToStore();
        };

        // Motion playback method - optimized, removed redundant checks
        const playMotion = (group, index, motion) => {
            if (!currentHeroModel.value) return;

            // Stop current motion
            if (isMotionPlaying.value) {
                currentHeroModel.value.model.stopMotions();
            }

            // Play new motion
            currentHeroModel.value.playMotion(group, index);

            // Update state
            isMotionPlaying.value = true;
            currentPlayingMotion.value = {
                group,
                index,
                isPlaying: true,
                name: motion?.Text || `${group}_${index}`,
            };

            message.success(
                `Playing motion: ${currentPlayingMotion.value.name}`,
            );
            syncSettingsToStore();
        };

        const stopCurrentMotion = () => {
            if (!currentHeroModel.value) return;

            currentHeroModel.value.model.stopMotions();
            isMotionPlaying.value = false;
            currentPlayingMotion.value = null;

            message.success("Motion stopped");
            syncSettingsToStore();
        };

        const playRandomMotion = () => {
            if (
                !currentHeroModel.value ||
                Object.keys(motions.value).length === 0
            )
                return;

            const groups = Object.keys(motions.value);
            const randomGroup =
                groups[Math.floor(Math.random() * groups.length)];
            const motionGroup = motions.value[randomGroup];
            const randomIndex = Math.floor(Math.random() * motionGroup.length);
            const motion = motionGroup[randomIndex];

            playMotion(randomGroup, randomIndex, motion);
        };

        const playRandomMotionFromGroup = (groupName) => {
            if (!currentHeroModel.value || !motions.value[groupName]) return;

            const motionGroup = motions.value[groupName];
            const randomIndex = Math.floor(Math.random() * motionGroup.length);
            const motion = motionGroup[randomIndex];

            playMotion(groupName, randomIndex, motion);
        };

        const isCurrentMotion = (group, index) => {
            return (
                currentPlayingMotion.value &&
                currentPlayingMotion.value.group === group &&
                currentPlayingMotion.value.index === index
            );
        };

        // Interaction update methods - optimized, removed redundant checks
        const updateWheelZoom = () => {
            try {
                // Directly call Live2D manager's wheel zoom setting
                if (live2dStore?.manager) {
                    live2dStore.manager.setWheelZoomEnabled(
                        modelSettings.wheelZoom,
                    );
                }

                // Manually sync to Store to avoid duplicate calls
                syncSettingsToStore();

                console.log(
                    "🔍 [ModelSettings] Wheel zoom setting updated:",
                    modelSettings.wheelZoom,
                );
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to update wheel zoom setting:",
                    error,
                );
                message.error("Failed to update wheel zoom setting");
            }
        };

        const updateClickInteraction = () => {
            try {
                // Directly call Live2D manager's interaction setting
                if (live2dStore?.manager) {
                    live2dStore.manager.setInteractionEnabled(
                        modelSettings.clickInteraction,
                    );
                }

                // Also update model interactivity state for coordination
                if (currentHeroModel.value) {
                    const shouldBeInteractive =
                        modelSettings.interactive &&
                        modelSettings.clickInteraction;
                    currentHeroModel.value.setInteractive(shouldBeInteractive);
                }

                // Manually sync to Store to avoid duplicate calls
                syncSettingsToStore();

                console.log(
                    "🖱️ [ModelSettings] Mouse interaction setting updated:",
                    modelSettings.clickInteraction,
                );
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to update mouse interaction setting:",
                    error,
                );
                message.error("Failed to update mouse interaction setting");
            }
        };

        // Zoom settings update method - optimized
        function updateZoomSettings() {
            try {
                // Only handle zoom step, no longer apply min/max limits
                const zoomSpeed = Math.max(
                    0.001,
                    Math.min(0.1, modelSettings.zoomSpeed),
                );

                // Check if live2dStore and manager exist
                if (!live2dStore) {
                    console.warn(
                        "⚠️ [ModelSettings] live2dStore does not exist, skipping zoom settings update",
                    );
                    return;
                }

                if (!live2dStore.manager) {
                    console.warn(
                        "⚠️ [ModelSettings] live2dStore.manager does not exist, skipping zoom settings update",
                    );
                    return;
                }

                // Check if manager has updateZoomSettings method
                if (
                    typeof live2dStore.manager.updateZoomSettings !== "function"
                ) {
                    console.warn(
                        "⚠️ [ModelSettings] manager.updateZoomSettings method does not exist, manager type:",
                        typeof live2dStore.manager,
                    );
                    console.log(
                        "🔍 [ModelSettings] manager对象:",
                        live2dStore.manager,
                    );
                    return;
                }

                // Directly update Live2D manager's zoom settings
                live2dStore.manager.updateZoomSettings({
                    zoomSpeed: zoomSpeed,
                });

                // Manually sync to Store to avoid duplicate calls
                syncSettingsToStore();

                console.log("⚙️ [ModelSettings] Zoom settings updated:", {
                    speed: zoomSpeed.toFixed(3),
                });
            } catch (error) {
                console.error(
                    "❌ [ModelSettings] Failed to update zoom settings:",
                    error,
                );
                console.error("🔍 [ModelSettings] Error details:", {
                    live2dStore: !!live2dStore,
                    manager: !!live2dStore?.manager,
                    managerType: typeof live2dStore?.manager,
                    hasUpdateZoomSettings:
                        typeof live2dStore?.manager?.updateZoomSettings,
                });
                message.error("Failed to update zoom settings");
            }
        }

        // State sync manager integration methods - optimized, simplified logic
        const registerStateSync = () => {
            if (!currentModel.value || !currentHeroModel.value) return;

            const modelId = currentModel.value.id;

            // Register sync callback - simplified
            globalStateSyncManager.registerSyncCallback(
                modelId,
                (currentState) => {
                    if (!currentState || !stateSyncEnabled.value) return;

                    // Avoid frequent syncing
                    const now = Date.now();
                    if (now - lastSyncTime.value < syncInterval) return;
                    lastSyncTime.value = now;

                    // Unified state application to UI
                    const applyStateToUI = (
                        key,
                        targetRef,
                        sourceValue,
                        tolerance = 0,
                        min = -Infinity,
                        max = Infinity,
                    ) => {
                        if (sourceValue !== undefined) {
                            if (
                                typeof sourceValue === "number" &&
                                Math.abs(sourceValue - targetRef.value) >
                                    tolerance
                            ) {
                                targetRef.value = Math.max(
                                    min,
                                    Math.min(max, sourceValue),
                                );
                            } else if (
                                typeof sourceValue === "boolean" &&
                                sourceValue !== targetRef.value
                            ) {
                                targetRef.value = sourceValue;
                            } else if (
                                typeof sourceValue === "object" &&
                                JSON.stringify(sourceValue) !==
                                    JSON.stringify(targetRef.value)
                            ) {
                                targetRef.value = sourceValue;
                            }
                            // Also sync boolean values in modelSettings
                            if (
                                modelSettings[key] !== undefined &&
                                typeof modelSettings[key] === "boolean"
                            ) {
                                modelSettings[key] = sourceValue;
                            }
                        }
                    };

                    applyStateToUI(
                        "scale",
                        modelSettings.scale,
                        currentState.scale,
                        0.001,
                        0.01,
                        1,
                    );
                    applyStateToUI(
                        "rotation",
                        modelSettings.rotation,
                        currentState.rotation,
                        0.1,
                        0,
                        360,
                    );
                    applyStateToUI(
                        "breathing",
                        modelSettings.breathing,
                        currentState.breathing,
                    );
                    applyStateToUI(
                        "eyeBlinking",
                        modelSettings.eyeBlinking,
                        currentState.eyeBlinking,
                    );
                    applyStateToUI(
                        "interactive",
                        modelSettings.interactive,
                        currentState.interactive,
                    );
                    applyStateToUI(
                        "wheelZoom",
                        modelSettings.wheelZoom,
                        currentState.wheelZoom,
                    );
                    applyStateToUI(
                        "clickInteraction",
                        modelSettings.clickInteraction,
                        currentState.clickInteraction,
                    );
                    applyStateToUI(
                        "enableAudio",
                        modelSettings.enableAudio,
                        currentState.audio,
                    );
                    applyStateToUI(
                        "showText",
                        modelSettings.showText,
                        currentState.text,
                    );

                    // Complex object sync
                    if (
                        currentState.expression !== undefined &&
                        currentState.expression !== currentExpression.value
                    ) {
                        currentExpression.value = currentState.expression;
                    }

                    if (currentState.motion !== undefined) {
                        if (
                            currentState.motion &&
                            JSON.stringify(currentState.motion) !==
                                JSON.stringify(currentPlayingMotion.value)
                        ) {
                            currentPlayingMotion.value = currentState.motion;
                            isMotionPlaying.value =
                                currentState.motion.isPlaying;
                        } else if (
                            !currentState.motion &&
                            isMotionPlaying.value
                        ) {
                            isMotionPlaying.value = false;
                            currentPlayingMotion.value = null;
                        }
                    }

                    if (
                        currentState.parameters &&
                        typeof currentState.parameters === "object"
                    ) {
                        // Clear existing parameters
                        for (const key in currentParameters) {
                            delete currentParameters[key];
                        }
                        // Copy new parameters
                        Object.assign(
                            currentParameters,
                            currentState.parameters,
                        );
                    }

                    if (
                        currentState.parts &&
                        typeof currentState.parts === "object"
                    ) {
                        // Clear existing parts
                        for (const key in currentParts) {
                            delete currentParts[key];
                        }
                        // Copy new parts
                        Object.assign(currentParts, currentState.parts);
                    }

                    console.log(
                        "🔄 [ModelSettings] 状态已从模型同步到UI:",
                        modelId,
                        currentState,
                    );
                },
            );

            console.log("📝 [ModelSettings] State sync registered:", modelId);
        };

        const unregisterStateSync = () => {
            if (!currentModel.value) return;

            const modelId = currentModel.value.id;
            globalStateSyncManager.unregisterSyncCallback(modelId);
            console.log("🗑️ [ModelSettings] State sync unregistered:", modelId);
        };

        const syncUISettingsToModel = () => {
            if (
                !currentModel.value ||
                !currentHeroModel.value ||
                !stateSyncEnabled.value
            )
                return;

            const modelId = currentModel.value.id;
            const uiSettings = {
                scale: modelSettings.scale,
                rotation: modelSettings.rotation,
                breathing: modelSettings.breathing,
                eyeBlinking: modelSettings.eyeBlinking,
                interactive: modelSettings.interactive,
                expression: currentExpression.value,
                motion: currentPlayingMotion.value,
                parameters: currentParameters,
                parts: currentParts,
                audio: currentAudioState.value,
                text: currentTextState.value,
            };

            // Use state sync manager to sync settings
            const applied = globalStateSyncManager.syncUISettingsToModel(
                modelId,
                currentHeroModel.value,
                uiSettings,
            );

            if (applied) {
                console.log(
                    "✅ [ModelSettings] UI settings synced to model:",
                    modelId,
                    uiSettings,
                );
            }
        };

        const validateStateConsistency = () => {
            if (!currentModel.value || !currentHeroModel.value) return;

            const modelId = currentModel.value.id;
            const expectedState = {
                scale: modelSettings.scale,
                rotation: modelSettings.rotation,
                breathing: modelSettings.breathing,
                eyeBlinking: modelSettings.eyeBlinking,
                interactive: modelSettings.interactive,
                expression: currentExpression.value,
                motion: currentPlayingMotion.value,
                parameters: currentParameters,
                parts: currentParts,
                audio: currentAudioState.value,
                text: currentTextState.value,
            };

            // Get current model state
            const currentState = globalStateSyncManager.getModelState(
                currentHeroModel.value,
            );

            const validation = globalStateSyncManager.validateStateConsistency(
                modelId,
                expectedState,
                currentState,
            );

            if (!validation.isConsistent) {
                console.warn(
                    "⚠️ [ModelSettings] State inconsistency, attempting force sync:",
                    validation.inconsistencies,
                );

                // Attempt force sync
                const success = globalStateSyncManager.forceSyncState(
                    modelId,
                    currentHeroModel.value,
                    expectedState,
                );

                if (success) {
                    console.log("✅ [ModelSettings] Force sync successful");
                } else {
                    console.error("❌ [ModelSettings] Force sync failed");
                }
            }

            return validation;
        };

        // Initialization on component mount
        onMounted(() => {
            console.log(
                "🚀 [ModelSettings] Component mounted, initializing settings sync",
            );

            // If there's a current model, try to load its settings
            if (currentModel.value) {
                loadSettingsFromStore();

                // Register state sync
                nextTick(() => {
                    registerStateSync();

                    // Initialize wheel zoom settings
                    if (
                        live2dStore?.manager &&
                        modelSettings.wheelZoom !== undefined
                    ) {
                        live2dStore.manager.setWheelZoomEnabled(
                            modelSettings.wheelZoom,
                        );
                        console.log(
                            "🔍 [ModelSettings] Wheel zoom initialized:",
                            modelSettings.wheelZoom,
                        );
                    }
                });
            }

            // Display resource manager status in development environment
            if (import.meta.env.DEV) {
                console.log(
                    "📊 [ModelSettings] Resource manager status:",
                    globalResourceManager.getResourceCount(),
                );
            }
        });

        // Cleanup on component unmount
        onUnmounted(() => {
            console.log(
                "🧹 [ModelSettings] Component unmounting, starting resource cleanup",
            );

            // Register cleanup callback to resource manager
            globalResourceManager.registerCleanupCallback(() => {
                // Unregister state sync
                unregisterStateSync();

                // Cleanup debounce timer
                if (syncDebounceTimer.value) {
                    clearTimeout(syncDebounceTimer.value);
                    syncDebounceTimer.value = null;
                }

                // Cleanup all resources
                cleanupResources();

                // Final sync of settings to Store
                if (settingsSyncEnabled.value && currentHeroModel.value) {
                    syncSettingsToStore();
                }
            });

            console.log(
                "📝 [ModelSettings] Cleanup callback registered to resource manager",
            );
        });

        // Basic methods
        const goBack = () => {
            emit("back");
        };

        const getModelDisplayName = (url) => {
            if (!url) return "No Model Selected";

            try {
                // Try to extract filename from URL
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const filename = pathname.split("/").pop();

                if (filename && filename !== "") {
                    // Remove file extension
                    return filename.replace(
                        /\.(model3\.json|model\.json|json)$/i,
                        "",
                    );
                }

                // If unable to extract from URL, return hostname
                return urlObj.hostname || "Unknown Model";
            } catch (error) {
                // If URL parsing fails, try to extract from path
                const pathParts = url.split("/");
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && lastPart !== "") {
                    return lastPart.replace(
                        /\.(model3\.json|model\.json|json)$/i,
                        "",
                    );
                }
                return "Unknown Model";
            }
        };

        const getMotionDisplayName = (motion, index) => {
            if (!motion) return `Motion ${index + 1}`;

            // Prioritize Text field
            if (motion.Text) {
                return motion.Text;
            }

            // Use File field (remove extension)
            if (motion.File) {
                return motion.File.replace(
                    /\.(motion3\.json|motion\.json|json)$/i,
                    "",
                );
            }

            // Use Sound field
            if (motion.Sound) {
                return `Audio: ${motion.Sound}`;
            }

            // Default: return index
            return `Motion ${index + 1}`;
        };

        const resetScale = () => {
            modelSettings.scale = 0.2;
            if (currentHeroModel.value?.setScale) {
                currentHeroModel.value.setScale(0.2);
            }
            syncSettingsToStore();
        };

        return {
            // Reactive data
            currentModel,
            currentHeroModel,
            expressions,
            motions,
            parameters,
            partOpacity,
            modelSettings,
            loading,

            // Motion playback state
            isMotionPlaying,
            currentPlayingMotion,

            // Extended state
            currentExpression,
            currentParameters,
            currentParts,
            currentAudioState,
            currentTextState,

            // Methods
            goBack,
            setExpression,
            playMotion,
            stopCurrentMotion,
            playRandomMotion,
            playRandomMotionFromGroup,
            isCurrentMotion,
            getMotionDisplayName,
            getModelDisplayName,
            // Interaction methods
            updateWheelZoom,
            updateClickInteraction,
            updateZoomSettings,

            // Settings sync methods
            syncSettingsToStore,
            loadSettingsFromStore,

            // Sync control state
            settingsSyncEnabled,
            isLoadingFromStore,

            // State sync manager integration methods
            registerStateSync,
            unregisterStateSync,
            syncUISettingsToModel,
            validateStateConsistency,
            resetScale,
        };
    },
};
</script>

<style scoped>
:deep(.n-form-item-label) {
    font-weight: 500;
    font-size: 13px;
}

:deep(.n-slider) {
    margin: 8px 0;
}

:deep(.n-list-item) {
    transition: all 0.15s ease;
    border-radius: 4px;
    margin-bottom: 4px;
}

:deep(.n-list-item:hover) {
    transform: translateX(4px);
}

/* Motion playback state styles */
.motion-playing {
    background: linear-gradient(
        90deg,
        var(--n-warning-color-suppl) 0%,
        transparent 100%
    );
    border-left: 3px solid var(--n-warning-color);
}

.motion-playing:hover {
    background: linear-gradient(
        90deg,
        var(--n-warning-color-suppl) 0%,
        var(--n-warning-color-suppl) 20%,
        transparent 100%
    );
}

:deep(.n-collapse-item) {
    margin-bottom: 8px;
}

:deep(.n-collapse-item__header) {
    font-weight: 500;
    padding: 12px 16px;
}

:deep(.n-scrollbar) {
    padding-right: 8px;
}

.parameter-item,
.part-item {
    border-radius: 6px;
    padding: 12px;
}

/* Responsive design */
@media (max-width: 768px) {
    :deep(.n-form-item) {
        margin-bottom: 12px;
    }

    :deep(.n-space) {
        gap: 8px !important;
    }

    :deep(.n-card) {
        margin-bottom: 12px;
    }
}

/* 加载状态 */
:deep(.n-spin-container) {
    min-height: 200px;
}

/* 空状态样式 */
:deep(.n-empty) {
    padding: 20px;
}

/* 标签样式 */
:deep(.n-tag) {
    font-size: 11px;
}

/* 滚动条样式 */
:deep(.n-scrollbar-rail) {
    right: 2px;
}

:deep(.n-scrollbar-rail__scrollbar) {
    width: 4px;
    border-radius: 2px;
}

@media (max-width: 600px) {
    :deep(.n-card) {
        border-radius: 8px;
        box-shadow: none;
    }
    :deep(.n-form-item-label) {
        font-size: 12px;
    }
    :deep(.n-space) {
        gap: 4px !important;
    }
    :deep(.n-input-number),
    :deep(.n-slider) {
        font-size: 12px;
    }
    .parameter-item,
    .part-item {
        padding: 8px;
        border-radius: 6px;
    }
}

:deep(.motion-control-collapse .n-collapse-item__header) {
    display: block;
}
</style>
