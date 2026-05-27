<template>
    <n-form-item :label="label" label-placement="left" :style="formItemStyle">
        <n-space vertical style="width: 100%" :size="spaceSize">
            <n-slider
                :value="modelValue"
                :min="min"
                :max="max"
                :step="step"
                @update:value="handleSliderUpdate"
                :tooltip="true"
                :style="sliderStyle"
            />
            <n-space
                justify="space-between"
                align="center"
                v-if="showMinMaxInput"
            >
                <span
                    style="font-size: 11px; color: var(--n-text-color-disabled)"
                    >{{ min }}</span
                >
                <n-input-number
                    :value="modelValue"
                    :min="min"
                    :max="max"
                    :step="step"
                    size="tiny"
                    @update:value="handleInputNumberUpdate"
                    :style="inputNumberStyle"
                />
                <span
                    style="font-size: 11px; color: var(--n-text-color-disabled)"
                    >{{ max }}</span
                >
            </n-space>
            <n-space v-if="showResetButton">
                <n-button @click="handleReset" size="small" secondary>
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
                    Reset
                </n-button>
            </n-space>
        </n-space>
    </n-form-item>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
    label: string;
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number | null;
    showMinMaxInput?: boolean;
    showResetButton?: boolean;
    formItemStyle?: Record<string, string>;
    sliderStyle?: Record<string, string>;
    inputNumberStyle?: Record<string, string>;
    spaceSize?: string;
    updater?: ((value: number) => void) | null;
}>(), {
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: null,
    showMinMaxInput: true,
    showResetButton: false,
    formItemStyle: () => ({}),
    sliderStyle: () => ({}),
    inputNumberStyle: () => ({ width: "80px" }),
    spaceSize: "medium",
    updater: null,
});

const emit = defineEmits<{
    "update:modelValue": [value: number];
    reset: [];
}>();

const handleUpdate = (value: number) => {
    emit("update:modelValue", value);
    if (props.updater) {
        props.updater(value);
    }
};

const handleSliderUpdate = (value: number) => {
    handleUpdate(value);
};

const handleInputNumberUpdate = (value: number | null) => {
    if (value !== null) {
        handleUpdate(value);
    }
};

const handleReset = () => {
    if (props.defaultValue !== null && props.defaultValue !== undefined) {
        emit("update:modelValue", props.defaultValue);
    }
    emit("reset");
};
</script>

<style scoped>
/* Add local styles as needed */
</style>
