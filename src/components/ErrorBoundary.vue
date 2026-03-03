<template>
    <div class="error-boundary">
        <div v-if="hasError" class="error-container">
            <n-result
                status="error"
                title="Component Render Error"
                :description="errorMessage"
            >
                <template #icon>
                    <n-icon size="72" color="var(--n-error-color)">
                        <svg viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                            />
                        </svg>
                    </n-icon>
                </template>

                <template #footer>
                    <n-space>
                        <n-button @click="retry" type="primary">
                            Retry
                        </n-button>
                        <n-button @click="goHome" quaternary>
                            Go Home
                        </n-button>
                        <n-button
                            @click="showDetails = !showDetails"
                            quaternary
                        >
                            {{ showDetails ? "Hide" : "Show" }} Details
                        </n-button>
                    </n-space>
                </template>
            </n-result>

            <!-- Error details -->
            <n-collapse v-if="showDetails" style="margin-top: 16px">
                <n-collapse-item title="Error Details" name="details">
                    <n-code :code="errorDetails" language="javascript" />
                </n-collapse-item>
            </n-collapse>
        </div>

        <div v-else class="content-wrapper">
            <slot />
        </div>
    </div>
</template>

<script>
import { ref, onErrorCaptured, nextTick } from "vue";

const __DEV__ = import.meta.env.DEV;

export default {
    name: "ErrorBoundary",
    emits: ["error", "retry"],
    setup(props, { emit }) {
        const hasError = ref(false);
        const errorMessage = ref("");
        const errorDetails = ref("");
        const showDetails = ref(false);
        const retryCount = ref(0);
        const maxRetries = 3;

        // Capture child component errors
        onErrorCaptured((error, instance, info) => {
            console.error("🚨 [ErrorBoundary] Caught component error:", error);
            console.error("🚨 [ErrorBoundary] Error info:", info);
            console.error("🚨 [ErrorBoundary] Component instance:", instance);

            hasError.value = true;
            errorMessage.value = getErrorMessage(error, info);
            errorDetails.value = getErrorDetails(error, info);

            // Emit error event
            emit("error", { error, instance, info });

            // Prevent the error from propagating further up
            return false;
        });

        const getErrorMessage = (error, info) => {
            if (error.message) {
                if (error.message.includes("render function")) {
                    return "An error occurred during component rendering, possibly due to data state or property configuration issues";
                } else if (error.message.includes("Cannot read property")) {
                    return "Accessing undefined property, please check data initialization";
                } else if (error.message.includes("Cannot resolve component")) {
                    return "Cannot resolve component, please check component import and registration";
                } else {
                    return error.message;
                }
            }

            if (info) {
                if (info.includes("render")) {
                    return "An error occurred during component rendering";
                } else if (info.includes("setup")) {
                    return "An error occurred during component initialization";
                }
            }

            return "Unknown error";
        };

        const getErrorDetails = (error, info) => {
            const details = [];

            if (error.message) {
                details.push(`Error message: ${error.message}`);
            }

            if (error.stack) {
                details.push(`Error stack:\n${error.stack}`);
            }

            if (info) {
                details.push(`Vue info: ${info}`);
            }

            details.push(`Retry count: ${retryCount.value}/${maxRetries}`);
            details.push(`Time: ${new Date().toLocaleString()}`);

            return details.join("\n\n");
        };

        const retry = async () => {
            if (retryCount.value >= maxRetries) {
                errorMessage.value = `Maximum retry count reached (${maxRetries}), please refresh the page or contact support`;
                return;
            }

            __DEV__ && console.debug("[ErrorBoundary] Attempting retry...");
            retryCount.value++;

            // Reset error state
            hasError.value = false;
            errorMessage.value = "";
            errorDetails.value = "";
            showDetails.value = false;

            // Wait for the next tick before re-rendering
            await nextTick();

            emit("retry");
        };

        const goHome = () => {
            __DEV__ && console.debug("[ErrorBoundary] Returning to home");
            // Reset all state
            hasError.value = false;
            errorMessage.value = "";
            errorDetails.value = "";
            showDetails.value = false;
            retryCount.value = 0;

            // Trigger route navigation to home page
            window.dispatchEvent(new CustomEvent("navigate-home"));
        };

        const reset = () => {
            hasError.value = false;
            errorMessage.value = "";
            errorDetails.value = "";
            showDetails.value = false;
            retryCount.value = 0;
        };

        return {
            hasError,
            errorMessage,
            errorDetails,
            showDetails,
            retry,
            goHome,
            reset,
        };
    },
};
</script>

<style scoped>
.error-boundary {
    width: 100%;
    height: 100%;
}

.error-container {
    padding: 24px;
    text-align: center;
}

.content-wrapper {
    width: 100%;
    height: 100%;
}

/* Responsive design */
@media (max-width: 768px) {
    .error-container {
        padding: 1px;
    }

    :deep(.n-result-header) {
        font-size: 18px;
    }

    :deep(.n-result-description) {
        font-size: 14px;
    }
}
</style>
