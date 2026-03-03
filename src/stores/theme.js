import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { globalResourceManager } from "../utils/resource-manager.js";

export const useThemeStore = defineStore("theme", () => {
  // State
  const currentTheme = ref("auto"); // 'light', 'dark', 'auto'
  const systemPrefersDark = ref(false);
  const mediaQuery = ref(null);

  // Computed properties
  const isDark = computed(() => {
    if (currentTheme.value === "auto") {
      return systemPrefersDark.value;
    }
    return currentTheme.value === "dark";
  });

  // Get the current actual theme
  const actualTheme = computed(() => {
    if (currentTheme.value === "auto") {
      return systemPrefersDark.value ? "dark" : "light";
    }
    return currentTheme.value;
  });

  // Apply theme to DOM
  const applyThemeToDOM = (theme) => {
    const body = document.body;

    // Remove all theme-related class names and attributes
    body.classList.remove("light-theme", "dark-theme");
    body.removeAttribute("aria-hidden");
    body.removeAttribute("data-theme");

    // Add new theme class name
    body.classList.add(`${theme}-theme`);

    // Set data-theme attribute for CSS selectors
    body.setAttribute("data-theme", theme);

    // Set the correct color-scheme
    body.style.colorScheme = theme;

    // Update the HTML root element's theme attribute
    document.documentElement.setAttribute("data-theme", theme);

    // console.log(`🎨 [ThemeStore] Theme switched to: ${theme}`)
  };

  // Methods
  const setTheme = (theme) => {
    if (["light", "dark", "auto"].includes(theme)) {
      currentTheme.value = theme;
      localStorage.setItem("theme", theme);

      // Apply theme to DOM
      if (theme === "auto") {
        applyThemeToDOM(systemPrefersDark.value ? "dark" : "light");
      } else {
        applyThemeToDOM(theme);
      }

      // Trigger theme change event
      window.dispatchEvent(
        new CustomEvent("theme:changed", {
          detail: { theme: actualTheme.value },
        }),
      );
    }
  };

  const toggleTheme = () => {
    if (currentTheme.value === "light") {
      setTheme("dark");
    } else if (currentTheme.value === "dark") {
      setTheme("auto");
    } else {
      setTheme("light");
    }
  };

  // Handle system theme change
  const handleSystemThemeChange = (e) => {
    systemPrefersDark.value = e.matches;

    // When system theme changes, update theme if in auto mode
    if (currentTheme.value === "auto") {
      applyThemeToDOM(e.matches ? "dark" : "light");

      // Trigger theme change event
      window.dispatchEvent(
        new CustomEvent("theme:changed", {
          detail: { theme: actualTheme.value },
        }),
      );
    }
  };

  const initTheme = () => {
    // Read theme settings from localStorage
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme && ["light", "dark", "auto"].includes(savedTheme)) {
      currentTheme.value = savedTheme;
    }

    // Listen for system theme changes
    mediaQuery.value = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark.value = mediaQuery.value.matches;

    // Register event listener to resource manager
    const changeHandler = handleSystemThemeChange;
    mediaQuery.value.addEventListener("change", changeHandler);

    globalResourceManager.registerEventListener(
      mediaQuery.value,
      "change",
      changeHandler,
    );

    // Apply initial theme
    applyThemeToDOM(actualTheme.value);

    // console.log(`🎨 [ThemeStore] Theme initialization complete: ${actualTheme.value}`)
  };

  // Clean up resources
  const cleanup = () => {
    if (mediaQuery.value) {
      mediaQuery.value.removeEventListener("change", handleSystemThemeChange);
      mediaQuery.value = null;
    }
  };

  // Register cleanup callback
  globalResourceManager.registerCleanupCallback(cleanup);

  return {
    currentTheme,
    systemPrefersDark,
    isDark,
    actualTheme,
    setTheme,
    toggleTheme,
    initTheme,
    cleanup,
  };
});
