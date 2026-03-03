<template>
    <div>
        <n-card title="Model Selection" :bordered="false">
            <template #header-extra>
                <n-button
                    quaternary
                    circle
                    @click="refreshAll"
                    :loading="loading"
                >
                    <template #icon>
                        <n-icon>
                            <svg viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                                />
                            </svg>
                        </n-icon>
                    </template>
                </n-button>
            </template>

            <div class="model-selector-vertical-layout">
                <!-- Tabs: Local / Model Library -->
                <n-tabs v-model:value="activeTab" type="segment" animated>
                    <!-- Local Tab -->
                    <n-tab-pane name="local" tab="Local">
                        <div class="tab-content">
                            <!-- Manual URL Input -->
                            <n-card
                                class="add-model-card"
                                size="small"
                                :bordered="true"
                            >
                                <n-space vertical :size="10">
                                    <n-text depth="3" style="font-size: 12px">
                                        Enter a model URL or select from local
                                        index:
                                    </n-text>
                                    <n-input-group>
                                        <n-select
                                            v-model:value="modelUrl"
                                            placeholder="Select or type model URL..."
                                            :options="localModelOptions"
                                            :disabled="addingModel"
                                            clearable
                                            filterable
                                            tag
                                            style="flex: 1"
                                        >
                                            <template #empty>
                                                <div
                                                    style="
                                                        text-align: center;
                                                        padding: 12px;
                                                    "
                                                >
                                                    <n-text depth="3"
                                                        >No local model index
                                                        found</n-text
                                                    >
                                                    <br />
                                                    <n-text
                                                        depth="3"
                                                        style="font-size: 11px"
                                                    >
                                                        Type a URL manually
                                                    </n-text>
                                                </div>
                                            </template>
                                        </n-select>
                                        <n-button
                                            type="primary"
                                            @click="addModel"
                                            :disabled="!modelUrl || addingModel"
                                            :loading="addingModel"
                                        >
                                            <template #icon>
                                                <n-icon>
                                                    <svg viewBox="0 0 24 24">
                                                        <path
                                                            fill="currentColor"
                                                            d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                                                        />
                                                    </svg>
                                                </n-icon>
                                            </template>
                                            Load
                                        </n-button>
                                    </n-input-group>
                                </n-space>
                            </n-card>

                            <!-- Local Models List -->
                            <div
                                v-if="localModelOptions.length > 0"
                                class="section-header"
                            >
                                <n-text strong style="font-size: 13px"
                                    >Available Local Models</n-text
                                >
                                <n-tag size="small" type="info">
                                    {{ localModelOptions.length }}
                                </n-tag>
                            </div>
                            <div
                                v-if="localModelOptions.length > 0"
                                class="models-grid"
                            >
                                <div
                                    v-for="opt in localModelOptions"
                                    :key="opt.value?.path || opt.value"
                                    class="model-grid-item"
                                    @click="loadLocalModel(opt)"
                                >
                                    <div class="model-grid-icon">
                                        <n-icon
                                            size="24"
                                            color="var(--n-primary-color)"
                                        >
                                            <svg viewBox="0 0 24 24">
                                                <path
                                                    fill="currentColor"
                                                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                                                />
                                            </svg>
                                        </n-icon>
                                    </div>
                                    <div class="model-grid-info">
                                        <div class="model-grid-name">
                                            {{ opt.label }}
                                        </div>
                                        <div class="model-grid-path">
                                            {{
                                                opt.value?.path ||
                                                opt.value ||
                                                ""
                                            }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <n-empty
                                v-else-if="!loading"
                                description="No local models found"
                                style="margin: 24px 0"
                            >
                                <template #extra>
                                    <n-text depth="3" style="font-size: 12px">
                                        Place models in
                                        <n-text code>public/models/</n-text>
                                        and run generate script, or enter URL
                                        above
                                    </n-text>
                                </template>
                            </n-empty>
                        </div>
                    </n-tab-pane>

                    <!-- Model Library Tab -->
                    <n-tab-pane name="library" tab="Model Library">
                        <div class="tab-content">
                            <!-- Search bar -->
                            <n-input
                                v-model:value="librarySearch"
                                placeholder="Search character or costume..."
                                clearable
                                style="margin-bottom: 10px"
                            >
                                <template #prefix>
                                    <n-icon size="16">
                                        <svg viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z"
                                            />
                                        </svg>
                                    </n-icon>
                                </template>
                                <template #suffix>
                                    <n-text
                                        v-if="librarySearch"
                                        depth="3"
                                        style="font-size: 11px"
                                    >
                                        {{ flatFilteredModels.length }} results
                                    </n-text>
                                </template>
                            </n-input>

                            <!-- Loading state -->
                            <div
                                v-if="libraryLoading"
                                style="text-align: center; padding: 40px 0"
                            >
                                <n-spin size="medium">
                                    <template #description
                                        >Loading model library...</template
                                    >
                                </n-spin>
                            </div>

                            <!-- View toggle -->
                            <div
                                v-else-if="masterData.length > 0"
                                class="library-controls"
                            >
                                <n-space justify="space-between" align="center">
                                    <n-text depth="3" style="font-size: 12px">
                                        {{ totalModelCount }} models available
                                    </n-text>
                                    <n-button-group size="tiny">
                                        <n-button
                                            :type="
                                                libraryView === 'flat'
                                                    ? 'primary'
                                                    : 'default'
                                            "
                                            @click="libraryView = 'flat'"
                                            :ghost="libraryView !== 'flat'"
                                        >
                                            <template #icon>
                                                <n-icon size="14">
                                                    <svg viewBox="0 0 24 24">
                                                        <path
                                                            fill="currentColor"
                                                            d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"
                                                        />
                                                    </svg>
                                                </n-icon>
                                            </template>
                                            List
                                        </n-button>
                                        <n-button
                                            :type="
                                                libraryView === 'grouped'
                                                    ? 'primary'
                                                    : 'default'
                                            "
                                            @click="libraryView = 'grouped'"
                                            :ghost="libraryView !== 'grouped'"
                                        >
                                            <template #icon>
                                                <n-icon size="14">
                                                    <svg viewBox="0 0 24 24">
                                                        <path
                                                            fill="currentColor"
                                                            d="M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"
                                                        />
                                                    </svg>
                                                </n-icon>
                                            </template>
                                            Grouped
                                        </n-button>
                                    </n-button-group>
                                </n-space>
                            </div>

                            <!-- FLAT LIST VIEW: All models as a scrollable list -->
                            <div
                                v-if="
                                    !libraryLoading &&
                                    masterData.length > 0 &&
                                    libraryView === 'flat'
                                "
                                class="library-scroll"
                            >
                                <div
                                    v-if="flatFilteredModels.length > 0"
                                    class="models-flat-list"
                                >
                                    <div
                                        v-for="item in flatFilteredModels"
                                        :key="item.costume.path"
                                        class="model-flat-item"
                                        :class="{
                                            'model-flat-loading':
                                                loadingLibraryModel ===
                                                item.costume.path,
                                        }"
                                        @click="
                                            loadLibraryModel(
                                                item.game,
                                                item.char,
                                                item.costume,
                                            )
                                        "
                                    >
                                        <div class="model-flat-icon">
                                            <n-icon
                                                size="18"
                                                color="var(--n-primary-color)"
                                            >
                                                <svg viewBox="0 0 24 24">
                                                    <path
                                                        fill="currentColor"
                                                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                    />
                                                </svg>
                                            </n-icon>
                                        </div>
                                        <div class="model-flat-info">
                                            <div class="model-flat-name">
                                                {{ item.char.charName }}
                                                <n-text
                                                    depth="3"
                                                    style="font-size: 11px"
                                                    >—
                                                    {{
                                                        item.costume.costumeName
                                                    }}</n-text
                                                >
                                            </div>
                                            <div class="model-flat-meta">
                                                <n-tag
                                                    size="tiny"
                                                    :bordered="false"
                                                    type="info"
                                                >
                                                    {{ item.game.gameName }}
                                                </n-tag>
                                                <span
                                                    class="model-flat-path-text"
                                                >
                                                    {{
                                                        extractFileName(
                                                            item.costume.path,
                                                        )
                                                    }}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="model-flat-action">
                                            <n-button
                                                size="tiny"
                                                type="primary"
                                                ghost
                                                :loading="
                                                    loadingLibraryModel ===
                                                    item.costume.path
                                                "
                                                @click.stop="
                                                    loadLibraryModel(
                                                        item.game,
                                                        item.char,
                                                        item.costume,
                                                    )
                                                "
                                            >
                                                Load
                                            </n-button>
                                        </div>
                                    </div>
                                </div>

                                <!-- No results after search -->
                                <n-empty
                                    v-else-if="librarySearch"
                                    description="No matching models found"
                                    style="margin: 24px 0"
                                >
                                    <template #icon>
                                        <n-icon
                                            size="36"
                                            color="var(--n-text-color-disabled)"
                                        >
                                            <svg viewBox="0 0 24 24">
                                                <path
                                                    fill="currentColor"
                                                    d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z"
                                                />
                                            </svg>
                                        </n-icon>
                                    </template>
                                </n-empty>
                            </div>

                            <!-- GROUPED VIEW: Collapse by game → character → costume -->
                            <div
                                v-if="
                                    !libraryLoading &&
                                    masterData.length > 0 &&
                                    libraryView === 'grouped'
                                "
                                class="library-scroll"
                            >
                                <n-collapse
                                    :default-expanded-names="
                                        filteredMasterData.length === 1
                                            ? [filteredMasterData[0].gameName]
                                            : []
                                    "
                                    accordion
                                >
                                    <n-collapse-item
                                        v-for="game in filteredMasterData"
                                        :key="game.gameId"
                                        :title="game.gameName"
                                        :name="game.gameName"
                                    >
                                        <template #header-extra>
                                            <n-tag size="small" type="info">
                                                {{ game.character.length }}
                                                characters
                                            </n-tag>
                                        </template>

                                        <!-- Characters -->
                                        <n-collapse accordion>
                                            <n-collapse-item
                                                v-for="char in game.character"
                                                :key="char.charId"
                                                :title="char.charName"
                                                :name="char.charId"
                                            >
                                                <template #header-extra>
                                                    <n-tag
                                                        size="tiny"
                                                        type="success"
                                                    >
                                                        {{ char.live2d.length }}
                                                        skin(s)
                                                    </n-tag>
                                                </template>

                                                <!-- Costumes -->
                                                <n-list hoverable clickable>
                                                    <n-list-item
                                                        v-for="costume in char.live2d"
                                                        :key="costume.costumeId"
                                                        @click="
                                                            loadLibraryModel(
                                                                game,
                                                                char,
                                                                costume,
                                                            )
                                                        "
                                                        class="costume-item"
                                                        :class="{
                                                            'costume-loading':
                                                                loadingLibraryModel ===
                                                                costume.path,
                                                        }"
                                                    >
                                                        <template #prefix>
                                                            <n-icon
                                                                size="16"
                                                                color="var(--n-primary-color)"
                                                            >
                                                                <svg
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        fill="currentColor"
                                                                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                                    />
                                                                </svg>
                                                            </n-icon>
                                                        </template>
                                                        <n-thing>
                                                            <template #header>
                                                                <span
                                                                    style="
                                                                        font-size: 13px;
                                                                    "
                                                                    >{{
                                                                        costume.costumeName
                                                                    }}</span
                                                                >
                                                            </template>
                                                            <template
                                                                #description
                                                            >
                                                                <span
                                                                    class="costume-path-text"
                                                                >
                                                                    {{
                                                                        extractFileName(
                                                                            costume.path,
                                                                        )
                                                                    }}
                                                                </span>
                                                            </template>
                                                        </n-thing>
                                                        <template #suffix>
                                                            <n-button
                                                                size="tiny"
                                                                type="primary"
                                                                :loading="
                                                                    loadingLibraryModel ===
                                                                    costume.path
                                                                "
                                                                @click.stop="
                                                                    loadLibraryModel(
                                                                        game,
                                                                        char,
                                                                        costume,
                                                                    )
                                                                "
                                                            >
                                                                Load
                                                            </n-button>
                                                        </template>
                                                    </n-list-item>
                                                </n-list>
                                            </n-collapse-item>
                                        </n-collapse>
                                    </n-collapse-item>
                                </n-collapse>

                                <!-- No results after search -->
                                <n-empty
                                    v-if="
                                        filteredMasterData.length === 0 &&
                                        librarySearch
                                    "
                                    description="No matching models found"
                                    style="margin: 24px 0"
                                >
                                    <template #icon>
                                        <n-icon
                                            size="36"
                                            color="var(--n-text-color-disabled)"
                                        >
                                            <svg viewBox="0 0 24 24">
                                                <path
                                                    fill="currentColor"
                                                    d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z"
                                                />
                                            </svg>
                                        </n-icon>
                                    </template>
                                </n-empty>
                            </div>

                            <!-- Empty / Failed state -->
                            <n-empty
                                v-if="
                                    !libraryLoading && masterData.length === 0
                                "
                                description="Failed to load model library"
                                style="margin: 40px 0"
                            >
                                <template #extra>
                                    <n-button
                                        size="small"
                                        @click="loadMasterData"
                                    >
                                        Retry
                                    </n-button>
                                </template>
                            </n-empty>
                        </div>
                    </n-tab-pane>
                </n-tabs>

                <!-- Loaded Models List (always visible below tabs) -->
                <n-card
                    class="loaded-models-card"
                    title="Loaded Models"
                    size="small"
                >
                    <template #header-extra>
                        <n-space>
                            <span
                                style="
                                    font-size: 12px;
                                    color: var(--n-text-color-disabled);
                                "
                            >
                                {{ loadedModels.length }} model(s) loaded
                            </span>
                        </n-space>
                    </template>
                    <div class="models-list-scroll">
                        <n-space
                            vertical
                            v-if="loadedModels.length > 0"
                            size="large"
                        >
                            <n-card
                                v-for="model in loadedModels"
                                :key="model.id"
                                size="small"
                                :bordered="true"
                                hoverable
                                class="model-card"
                            >
                                <template #header>
                                    <n-space align="center">
                                        <n-icon size="20" color="#18a058">
                                            <svg viewBox="0 0 24 24">
                                                <path
                                                    fill="currentColor"
                                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                />
                                            </svg>
                                        </n-icon>
                                        <div>
                                            <div style="font-weight: 500">
                                                {{ getModelDisplayName(model) }}
                                            </div>
                                        </div>
                                    </n-space>
                                </template>
                                <template #header-extra>
                                    <div class="model-card-actions">
                                        <n-button
                                            size="small"
                                            @click="configureModel(model)"
                                            tertiary
                                        >
                                            <template #icon>
                                                <n-icon>
                                                    <svg viewBox="0 0 24 24">
                                                        <path
                                                            fill="currentColor"
                                                            d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"
                                                        />
                                                    </svg>
                                                </n-icon>
                                            </template>
                                            Settings
                                        </n-button>
                                        <n-popconfirm
                                            @positive-click="removeModel(model)"
                                            positive-text="Confirm"
                                            negative-text="Cancel"
                                        >
                                            <template #trigger>
                                                <n-button
                                                    size="small"
                                                    type="error"
                                                    secondary
                                                    circle
                                                >
                                                    <template #icon>
                                                        <n-icon>
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    fill="currentColor"
                                                                    d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12Z"
                                                                />
                                                            </svg>
                                                        </n-icon>
                                                    </template>
                                                </n-button>
                                            </template>
                                            Are you sure you want to remove
                                            model "{{
                                                getModelDisplayName(model)
                                            }}"?
                                        </n-popconfirm>
                                    </div>
                                </template>
                                <div class="model-path">
                                    {{ model.url }}
                                </div>
                            </n-card>
                        </n-space>
                        <n-empty
                            v-else
                            description="No loaded models"
                            style="margin: 24px 0"
                        >
                            <template #icon>
                                <n-icon
                                    size="48"
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
                            <template #extra>
                                <n-button size="small" @click="scrollToTop">
                                    Add your first model
                                </n-button>
                            </template>
                        </n-empty>
                    </div>
                </n-card>
            </div>
        </n-card>
    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useMessage, NEllipsis } from "naive-ui";
import { useLive2DStore } from "../stores/live2d";

export default {
    name: "ModelSelector",
    components: {
        NEllipsis,
    },
    emits: ["model-selected", "model-configure"],
    setup(_, { emit }) {
        const live2dStore = useLive2DStore();
        const message = useMessage();

        const loading = ref(false);
        const addingModel = ref(false);
        const loadingPresetModel = ref(null);
        const modelUrl = ref("");
        const localModelOptions = ref([]);
        const presetModels = ref([]);

        // Tab state
        const activeTab = ref("library");

        // Model Library state
        const masterData = ref([]);
        const libraryLoading = ref(false);
        const librarySearch = ref("");
        const loadingLibraryModel = ref(null);
        const libraryView = ref("flat"); // 'flat' or 'grouped'

        // Model sequence counter
        const modelCounter = ref(1);

        // Generate next model ID
        const generateModelId = () => {
            const allIds = Array.from(live2dStore.modelDataMap?.keys() || []);
            let maxNumber = 0;
            allIds.forEach((id) => {
                const match = id.match(/^model_(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxNumber) maxNumber = num;
                }
            });
            return `model_${maxNumber + 1}`;
        };

        // Get loaded models from store
        const loadedModels = computed(() => {
            return Array.from(live2dStore.modelDataMap?.values() || []);
        });

        // Total model count from library
        const totalModelCount = computed(() => {
            let count = 0;
            masterData.value.forEach((game) => {
                game.character.forEach((char) => {
                    count += char.live2d.length;
                });
            });
            return count;
        });

        // Flat list of all models from library (for flat view)
        const flatFilteredModels = computed(() => {
            const search = librarySearch.value.trim().toLowerCase();
            const results = [];

            masterData.value.forEach((game) => {
                game.character.forEach((char) => {
                    char.live2d.forEach((costume) => {
                        if (!search) {
                            results.push({ game, char, costume });
                        } else {
                            const matchChar = char.charName
                                .toLowerCase()
                                .includes(search);
                            const matchCostume = costume.costumeName
                                .toLowerCase()
                                .includes(search);
                            const matchPath = costume.path
                                .toLowerCase()
                                .includes(search);
                            const matchGame = game.gameName
                                .toLowerCase()
                                .includes(search);
                            if (
                                matchChar ||
                                matchCostume ||
                                matchPath ||
                                matchGame
                            ) {
                                results.push({ game, char, costume });
                            }
                        }
                    });
                });
            });

            return results;
        });

        // Filtered master data based on search (for grouped view)
        const filteredMasterData = computed(() => {
            const search = librarySearch.value.trim().toLowerCase();
            if (!search) return masterData.value;

            return masterData.value
                .map((game) => {
                    const filteredChars = game.character
                        .map((char) => {
                            const charMatch = char.charName
                                .toLowerCase()
                                .includes(search);
                            const filteredCostumes = char.live2d.filter(
                                (costume) =>
                                    charMatch ||
                                    costume.costumeName
                                        .toLowerCase()
                                        .includes(search) ||
                                    costume.path.toLowerCase().includes(search),
                            );
                            if (filteredCostumes.length > 0) {
                                return {
                                    ...char,
                                    live2d: charMatch
                                        ? char.live2d
                                        : filteredCostumes,
                                };
                            }
                            return null;
                        })
                        .filter(Boolean);

                    if (filteredChars.length > 0) {
                        return { ...game, character: filteredChars };
                    }
                    return null;
                })
                .filter(Boolean);
        });

        // Extract file name from URL for display
        const extractFileName = (url) => {
            if (!url) return "";
            try {
                const parts = url.split("/");
                return parts[parts.length - 1];
            } catch {
                return url;
            }
        };

        // Load master data from live2dMaster.json
        const loadMasterData = async () => {
            libraryLoading.value = true;
            try {
                const response = await fetch("/models/live2dMaster.json");
                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}: ${response.statusText}`,
                    );
                }
                const data = await response.json();
                if (data && Array.isArray(data.Master)) {
                    masterData.value = data.Master;
                    console.log(
                        "[ModelSelector] Model library loaded:",
                        masterData.value.length,
                        "games,",
                        totalModelCount.value,
                        "total models",
                    );
                } else {
                    console.warn("[ModelSelector] Invalid master data format");
                    masterData.value = [];
                }
            } catch (error) {
                console.error(
                    "[ModelSelector] Failed to load model library:",
                    error,
                );
                masterData.value = [];
            } finally {
                libraryLoading.value = false;
            }
        };

        // Load a model from the library
        const loadLibraryModel = async (game, char, costume) => {
            if (loadingLibraryModel.value) return;

            loadingLibraryModel.value = costume.path;
            try {
                const modelName = `${char.charName} - ${costume.costumeName}`;

                // Check if already loaded
                const existingModel = Array.from(
                    live2dStore?.modelDataMap?.values() || [],
                ).find((model) => model.url === costume.path);
                if (existingModel) {
                    message.warning(`Model "${modelName}" is already loaded`);
                    return;
                }

                const modelData = {
                    id: generateModelId(),
                    url: costume.path,
                    name: modelName,
                    description: `${game.gameName} - ${char.charName} - ${costume.costumeName}`,
                };

                console.log(
                    "[ModelSelector] Loading library model:",
                    modelData,
                );

                if (live2dStore?.setModelData) {
                    live2dStore.setModelData(modelData);
                }
                emit("model-selected", modelData);

                message.success(`Model "${modelName}" loaded successfully`);
            } catch (error) {
                console.error(
                    "[ModelSelector] Failed to load library model:",
                    error,
                );
                message.error("Failed to load model: " + error.message);
            } finally {
                loadingLibraryModel.value = null;
            }
        };

        // Load a local model from the grid
        const loadLocalModel = async (opt) => {
            if (addingModel.value) return;

            const modelDataRaw = opt.value;
            addingModel.value = true;
            try {
                let modelData;
                if (typeof modelDataRaw === "object") {
                    modelData = {
                        id: generateModelId(),
                        url: modelDataRaw.path,
                        name:
                            modelDataRaw.name ||
                            getModelDisplayName(modelDataRaw),
                        description: modelDataRaw.description || "",
                        thumbnail: modelDataRaw.thumbnail || "",
                        version: modelDataRaw.version || "",
                        author: modelDataRaw.author || "",
                        tags: modelDataRaw.tags || [],
                    };
                } else {
                    modelData = {
                        id: generateModelId(),
                        url: modelDataRaw,
                        name: getModelDisplayName(modelDataRaw),
                    };
                }

                const existingModel = Array.from(
                    live2dStore?.modelDataMap?.values() || [],
                ).find((model) => model.url === modelData.url);
                if (existingModel) {
                    message.warning(
                        `Model "${modelData.name}" is already loaded`,
                    );
                    return;
                }

                console.log("[ModelSelector] Loading local model:", modelData);
                if (live2dStore?.setModelData) {
                    live2dStore.setModelData(modelData);
                }
                emit("model-selected", modelData);
                message.success(
                    `Model "${modelData.name}" loaded successfully`,
                );
            } catch (error) {
                console.error(
                    "[ModelSelector] Failed to load local model:",
                    error,
                );
                message.error("Failed to load model");
            } finally {
                addingModel.value = false;
            }
        };

        // Methods
        const refreshAll = async () => {
            await loadModelData();
            await loadLocalModelsIndex();
            await loadMasterData();
        };

        const loadModelData = async () => {
            loading.value = true;
            presetModels.value = [];
            try {
                console.log("[ModelSelector] Checking server preset models...");

                console.log(
                    "[ModelSelector] Server connection removed, skipping preset models.",
                );
            } catch (error) {
                console.error(
                    "[ModelSelector] Failed to load model data:",
                    error,
                );
                message.error("Failed to load model data: " + error.message);
                presetModels.value = [];
            } finally {
                loading.value = false;
            }
        };

        const loadPresetModel = async (model) => {
            if (loadingPresetModel.value) return;

            loadingPresetModel.value = model.id;
            try {
                console.log("[ModelSelector] Loading preset model:", model);

                const modelData = {
                    id: model.id,
                    name: model.name,
                    url: model.url,
                    description: model.description,
                };
                emit("model-selected", modelData);
                message.success(
                    `Selected model "${model.name}", please wait for loading...`,
                );
            } catch (error) {
                console.error(
                    "[ModelSelector] Failed to load preset model:",
                    error,
                );
                message.error(`Failed to load model: ${error.message}`);
            } finally {
                loadingPresetModel.value = null;
            }
        };

        const addModel = async () => {
            let modelDataRaw = modelUrl.value;
            if (!modelDataRaw) {
                message.warning("Please select or enter a model URL");
                return;
            }

            addingModel.value = true;
            try {
                let modelData;
                if (typeof modelDataRaw === "object") {
                    modelData = {
                        id: generateModelId(),
                        url: modelDataRaw.path,
                        name:
                            modelDataRaw.name ||
                            getModelDisplayName(modelDataRaw),
                        description: modelDataRaw.description || "",
                        thumbnail: modelDataRaw.thumbnail || "",
                        version: modelDataRaw.version || "",
                        author: modelDataRaw.author || "",
                        tags: modelDataRaw.tags || [],
                    };
                } else {
                    modelData = {
                        id: generateModelId(),
                        url: modelDataRaw,
                        name: getModelDisplayName(modelDataRaw),
                    };
                }

                const existingModel = Array.from(
                    live2dStore?.modelDataMap?.values() || [],
                ).find((model) => model.url === modelData.url);
                if (existingModel) {
                    message.warning(
                        `Model with URL "${modelData.url}" is already loaded`,
                    );
                    return;
                }

                console.log("[ModelSelector] Adding custom model:", modelData);
                if (live2dStore?.setModelData) {
                    live2dStore.setModelData(modelData);
                }
                emit("model-selected", modelData);

                message.success(
                    `Custom model "${modelData.name}" added successfully`,
                );

                modelUrl.value = "";
            } catch (error) {
                console.error(
                    "[ModelSelector] Failed to add custom model:",
                    error,
                );
                message.error("Failed to add custom model");
            } finally {
                addingModel.value = false;
            }
        };

        const removeModel = async (model) => {
            try {
                console.log("[ModelSelector] Removing model:", model);

                // 1. Remove model from Live2DManager/PIXI scene
                if (live2dStore?.manager) {
                    try {
                        live2dStore.manager.removeModel(model.id);
                    } catch (e) {
                        console.warn(
                            "[ModelSelector] manager.removeModel failed:",
                            e,
                        );
                    }
                }

                // 2. Remove model data and instance from store
                if (live2dStore?.removeLoadedModel) {
                    live2dStore.removeLoadedModel(model.id);
                }

                // 3. If the removed model is the current model, clear current model
                if (live2dStore?.currentModel?.id === model.id) {
                    if (live2dStore?.setCurrentModel) {
                        live2dStore.setCurrentModel(null);
                    }
                }

                message.success(
                    `Model "${getModelDisplayName(model)}" has been removed`,
                );
            } catch (error) {
                console.error("[ModelSelector] Failed to remove model:", error);
                message.error("Failed to remove model");
            }
        };

        const configureModel = (model) => {
            console.log("[ModelSelector] Configure model:", model);
            emit("model-configure", model);
        };

        const scrollToTop = () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        };

        const getModelDisplayName = (modelOrUrl) => {
            if (!modelOrUrl) return "Unknown Model";
            if (typeof modelOrUrl === "object" && modelOrUrl.name) {
                return modelOrUrl.name;
            }
            let url =
                typeof modelOrUrl === "string" ? modelOrUrl : modelOrUrl.url;
            if (!url || typeof url !== "string") return "Unknown Model";
            try {
                const urlParts = url.split("/");
                const fileName = urlParts[urlParts.length - 1];
                return (
                    fileName.replace(/\.(json|moc3|model3\.json)$/i, "") ||
                    "Unknown Model"
                );
            } catch (error) {
                return "Unknown Model";
            }
        };

        // Model config update handler (via window events)
        const handleModelConfigUpdate = (event) => {
            console.log(
                "[ModelSelector] Received model config update:",
                event.detail,
            );
            const config = event.detail;

            if (config.model_info) {
                console.log(
                    "[ModelSelector] Updating preset model info:",
                    config.model_info,
                );

                const serverModel = {
                    id: config.model_info.name || "server-model",
                    name: config.model_info.name || "Server Model",
                    description: config.model_info.description,
                    url: config.model_info.url,
                    ...config.model_info,
                };
                presetModels.value = [serverModel];

                console.log(
                    "[ModelSelector] Preset model list updated:",
                    presetModels.value,
                );
            } else {
                presetModels.value = [];
                console.log(
                    "[ModelSelector] New config has no model info, clearing preset model list.",
                );
            }
        };

        const loadLocalModelsIndex = async () => {
            try {
                const response = await fetch("/models/models-index.json");
                if (!response.ok) {
                    console.warn(
                        `[ModelSelector] Local model index file /models/models-index.json not found`,
                    );
                    return;
                }
                const models = await response.json();
                if (Array.isArray(models)) {
                    localModelOptions.value = models
                        .map((model) => ({
                            label:
                                model.name || `${model.folder}/${model.file}`,
                            value: model,
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    console.log(
                        "[ModelSelector] Local model index loaded successfully:",
                        localModelOptions.value.length,
                        "models",
                    );
                }
            } catch (error) {
                console.error(
                    "[ModelSelector] Failed to load local model index:",
                    error,
                );
            }
        };

        onMounted(() => {
            window.addEventListener(
                "websocket:set-model-and-conf",
                handleModelConfigUpdate,
            );
            loadModelData();
            loadLocalModelsIndex();
            loadMasterData();
        });

        onUnmounted(() => {
            window.removeEventListener(
                "websocket:set-model-and-conf",
                handleModelConfigUpdate,
            );
        });

        return {
            activeTab,
            modelUrl,
            presetModels,
            localModelOptions,
            loadedModels,
            loading,
            addingModel,
            loadingPresetModel,

            // Library
            masterData,
            libraryLoading,
            librarySearch,
            libraryView,
            loadingLibraryModel,
            filteredMasterData,
            flatFilteredModels,
            totalModelCount,

            refreshAll,
            loadModelData,
            loadPresetModel,
            loadMasterData,
            loadLibraryModel,
            loadLocalModel,
            extractFileName,
            addModel,
            removeModel,
            configureModel,
            scrollToTop,
            getModelDisplayName,
        };
    },
};
</script>

<style scoped>
/*
 * CRITICAL: Force Naive UI internal containers to show content.
 *
 * Problem: multiple layers of n-card__content and n-tabs-pane-wrapper
 * all set overflow:hidden (some via inline styles), which clips the
 * model list even though the DOM nodes exist.
 *
 * Solution: override overflow on every wrapper between the scrollable-content
 * parent and the actual tab content, but keep scroll on specific containers.
 */

/* ---- Outermost card wrapping this entire component ---- */
/* The root n-card "Model Selection" — its content must not clip */
:deep(> .n-card > .n-card__content) {
    overflow: visible !important;
    height: auto !important;
}

/* ---- n-tabs internal wrappers ---- */
:deep(.n-tabs-pane-wrapper) {
    overflow: visible !important;
    height: auto !important;
}

:deep(.n-tab-pane) {
    overflow: visible !important;
    height: auto !important;
}

/* ---- Nested n-card inside each tab (add-model-card, library-card, etc.) ---- */
:deep(.tab-content .n-card > .n-card__content) {
    overflow: visible !important;
    height: auto !important;
}

/* ---- loaded-models-card: this ONE card needs its own scroll ---- */
:deep(.loaded-models-card > .n-card__content) {
    overflow-y: auto !important;
    height: auto !important;
    max-height: 38vh;
}

/* ---- Explicit scroll containers ---- */
.library-scroll {
    overflow-y: auto !important;
}

.models-list-scroll {
    overflow-y: auto !important;
}

.model-selector-vertical-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    /* do NOT set overflow or max-height here; let the parent scroll */
}

.tab-content {
    padding-top: 8px;
    display: block !important;
}

/* Section header */
.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 12px 0 8px 0;
    padding: 0 2px;
}

/* Local models grid */
.models-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.model-grid-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--n-border-color);
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--n-color);
}

.model-grid-item:hover {
    border-color: var(--n-primary-color);
    background: var(--n-primary-color-hover);
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.model-grid-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--n-primary-color-suppl);
    opacity: 0.8;
}

.model-grid-info {
    flex: 1;
    min-width: 0;
}

.model-grid-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.model-grid-path {
    font-size: 11px;
    color: var(--n-text-color-disabled);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
}

/* Library controls */
.library-controls {
    margin-bottom: 10px;
}

/* Library styles */
.library-scroll {
    max-height: 55vh;
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
}

.library-scroll::-webkit-scrollbar {
    width: 5px;
}

.library-scroll::-webkit-scrollbar-track {
    background: transparent;
}

.library-scroll::-webkit-scrollbar-thumb {
    background: var(--n-scrollbar-color);
    border-radius: 3px;
}

/* Flat list styles */
.models-flat-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.model-flat-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
}

.model-flat-item:hover {
    background: var(--n-primary-color-hover);
    border-color: var(--n-border-color);
    transform: translateX(2px);
}

.model-flat-item.model-flat-loading {
    opacity: 0.5;
    pointer-events: none;
}

.model-flat-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--n-primary-color-suppl);
    opacity: 0.7;
}

.model-flat-info {
    flex: 1;
    min-width: 0;
}

.model-flat-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.model-flat-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
}

.model-flat-path-text {
    font-size: 10px;
    color: var(--n-text-color-disabled);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.model-flat-action {
    flex-shrink: 0;
}

/* Grouped view costume items */
.costume-item {
    transition: all 0.15s ease;
    border-radius: 6px;
    cursor: pointer;
}

.costume-item:hover {
    transform: translateX(4px);
}

.costume-loading {
    opacity: 0.6;
    pointer-events: none;
}

.costume-path-text {
    font-size: 11px;
    color: var(--n-text-color-disabled);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Add model card */
.add-model-card {
    border-radius: 10px;
}

/* Loaded models styles */
.loaded-models-card {
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    max-height: 40vh;
}

.models-list-scroll {
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
}

.model-card {
    transition:
        box-shadow 0.2s,
        border-color 0.2s;
    border-left: 4px solid var(--n-primary-color);
    border-radius: 10px;
}

.model-card-actions {
    display: flex;
    gap: 8px;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.model-card:hover .model-card-actions {
    opacity: 1;
}

.model-path {
    font-size: 11px;
    color: var(--n-text-color-disabled);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Responsive design */
@media (max-width: 900px) {
    .model-selector-vertical-layout {
        gap: 8px;
    }

    .add-model-card,
    .loaded-models-card {
        max-width: 100%;
        min-width: 0;
    }

    .loaded-models-card {
        max-height: none;
    }

    .library-scroll {
        max-height: 40vh;
    }

    .model-flat-item {
        padding: 6px 8px;
    }
}

@media (max-width: 600px) {
    .model-flat-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .library-scroll {
        max-height: 35vh;
    }
}
</style>
