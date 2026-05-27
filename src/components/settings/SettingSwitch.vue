<template>
    <n-space justify="space-between" align="center">
        <span>{{ label }}</span>
        <n-switch :value="modelValue" @update:value="handleSwitchUpdate" />
    </n-space>
</template>

<script setup lang="ts">
const props = defineProps<{
    label: string;
    modelValue: boolean;
    updater?: ((value: boolean) => void) | null;
}>();

const emit = defineEmits<{
    "update:modelValue": [value: boolean];
}>();

const handleSwitchUpdate = (value: boolean) => {
    emit("update:modelValue", value);
    if (props.updater) {
        props.updater(value);
    }
};
</script>

<style scoped>
/* Add local styles as needed */
</style>
