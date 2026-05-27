import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { darkTheme } from "naive-ui";
import { globalResourceManager } from "../utils/resource-manager";

type ThemeMode = "light" | "dark" | "auto";
type ActualTheme = "light" | "dark";

const DARK_TOKENS = darkTheme.common;

const LIGHT_TOKENS: Record<string, string> = {
  bodyColor: "#fff",
  cardColor: "#fff",
  modalColor: "#fff",
  popoverColor: "#fff",
  tableColor: "#fff",
  inputColor: "rgba(0, 0, 0, 0.02)",
  actionColor: "rgba(0, 0, 0, 0.02)",
  tagColor: "rgba(0, 0, 0, 0.07)",
  tabColor: "rgba(0, 0, 0, 0.04)",
  hoverColor: "rgba(0, 0, 0, 0.06)",
  tableColorHover: "rgba(0, 0, 0, 0.06)",
  pressedColor: "rgba(0, 0, 0, 0.05)",
  codeColor: "rgba(0, 0, 0, 0.06)",
  tableHeaderColor: "rgba(0, 0, 0, 0.06)",
  avatarColor: "rgba(0, 0, 0, 0.1)",
  invertedColor: "rgb(0, 20, 40)",
  inputColorDisabled: "rgba(0, 0, 0, 0.04)",
  buttonColor2: "rgba(46, 51, 56, .05)",
  buttonColor2Hover: "rgba(46, 51, 56, .09)",
  buttonColor2Pressed: "rgba(46, 51, 56, .13)",
  textColorBase: "#000",
  textColor1: "rgb(31, 34, 37)",
  textColor2: "rgb(51, 54, 57)",
  textColor3: "rgb(118, 124, 130)",
  textColorDisabled: "rgba(194, 194, 194, 1)",
  placeholderColor: "rgba(194, 194, 194, 1)",
  placeholderColorDisabled: "rgba(209, 209, 209, 1)",
  iconColor: "rgba(194, 194, 194, 1)",
  iconColorDisabled: "rgba(209, 209, 209, 1)",
  iconColorHover: "rgba(146, 146, 146, 1)",
  iconColorPressed: "rgba(175, 175, 175, 1)",
  primaryColor: "#18a058",
  primaryColorHover: "#36ad6a",
  primaryColorPressed: "#0c7a43",
  primaryColorSuppl: "rgb(42, 148, 125)",
  infoColor: "#2080f0",
  infoColorHover: "#4098fc",
  infoColorPressed: "#1060c9",
  infoColorSuppl: "rgb(56, 137, 197)",
  successColor: "#18a058",
  successColorHover: "#36ad6a",
  successColorPressed: "#0c7a43",
  successColorSuppl: "rgb(42, 148, 125)",
  warningColor: "#f0a020",
  warningColorHover: "#fcb040",
  warningColorPressed: "#c97c10",
  warningColorSuppl: "rgb(240, 138, 0)",
  errorColor: "#d03050",
  errorColorHover: "#de576d",
  errorColorPressed: "#ab1f3f",
  errorColorSuppl: "rgb(208, 58, 82)",
  dividerColor: "rgb(239, 239, 245)",
  borderColor: "rgb(224, 224, 230)",
  closeIconColor: "rgba(102, 102, 102, 1)",
  closeIconColorHover: "rgba(102, 102, 102, 1)",
  closeIconColorPressed: "rgba(102, 102, 102, 1)",
  closeColorHover: "rgba(0, 0, 0, .09)",
  closeColorPressed: "rgba(0, 0, 0, .13)",
  clearColor: "rgba(0, 0, 0, 0.25)",
  clearColorHover: "rgba(0, 0, 0, 0.35)",
  clearColorPressed: "rgba(0, 0, 0, 0.2)",
  scrollbarColor: "rgba(0, 0, 0, 0.25)",
  scrollbarColorHover: "rgba(0, 0, 0, 0.4)",
  progressRailColor: "rgba(0, 0, 0, .08)",
  railColor: "rgba(0, 0, 0, 0.14)",
  boxShadow1:
    "0 1px 2px -2px rgba(0, 0, 0, .08), 0 3px 6px 0 rgba(0, 0, 0, .06), 0 5px 12px 4px rgba(0, 0, 0, .04)",
  boxShadow2:
    "0 3px 6px -4px rgba(0, 0, 0, .12), 0 6px 12px 0 rgba(0, 0, 0, .08), 0 9px 18px 8px rgba(0, 0, 0, .05)",
  boxShadow3:
    "0 6px 16px -9px rgba(0, 0, 0, .08), 0 9px 28px 0 rgba(0, 0, 0, .05), 0 12px 48px 16px rgba(0, 0, 0, .03)",
};

function tokensToCSSVars(tokens: Record<string, string>): Record<string, string> {
  const vars: Record<string, string> = Object.entries(tokens).reduce(
    (acc, [key, value]) => {
      const cssVar =
        "--n-" + key.replace(/([A-Z])/g, (c) => "-" + c.toLowerCase());
      acc[cssVar] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  if (vars["--n-text-color1"] && !vars["--n-text-color"]) {
    vars["--n-text-color"] = vars["--n-text-color1"];
  }
  if (vars["--n-card-color"] && !vars["--n-color-embedded"]) {
    vars["--n-color-embedded"] = vars["--n-card-color"];
  }

  return vars;
}

const DARK_CSS_VARS = tokensToCSSVars(DARK_TOKENS as unknown as Record<string, string>);
const LIGHT_CSS_VARS = tokensToCSSVars(LIGHT_TOKENS);

export const useThemeStore = defineStore("theme", () => {
  const currentTheme = ref<ThemeMode>("auto");
  const systemPrefersDark = ref(false);
  const mediaQuery = ref<MediaQueryList | null>(null);

  const isDark = computed(() => {
    if (currentTheme.value === "auto") {
      return systemPrefersDark.value;
    }
    return currentTheme.value === "dark";
  });

  const actualTheme = computed<ActualTheme>(() => {
    if (currentTheme.value === "auto") {
      return systemPrefersDark.value ? "dark" : "light";
    }
    return currentTheme.value;
  });

  const applyThemeToDOM = (theme: ActualTheme) => {
    const body = document.body;
    const root = document.documentElement;

    body.classList.remove("light-theme", "dark-theme");
    body.removeAttribute("aria-hidden");

    body.classList.add(`${theme}-theme`);
    body.setAttribute("data-theme", theme);
    root.setAttribute("data-theme", theme);

    root.style.colorScheme = theme;
    body.style.colorScheme = theme;

    const vars = theme === "dark" ? DARK_CSS_VARS : LIGHT_CSS_VARS;
    const style = root.style;
    for (const [cssVar, value] of Object.entries(vars)) {
      style.setProperty(cssVar, value);
    }

    body.style.background = vars["--n-body-color"];
    body.style.color = vars["--n-text-color1"];
  };

  const setTheme = (theme: ThemeMode) => {
    if (["light", "dark", "auto"].includes(theme)) {
      currentTheme.value = theme;
      localStorage.setItem("theme", theme);

      if (theme === "auto") {
        applyThemeToDOM(systemPrefersDark.value ? "dark" : "light");
      } else {
        applyThemeToDOM(theme);
      }

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

  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    systemPrefersDark.value = e.matches;

    if (currentTheme.value === "auto") {
      applyThemeToDOM(e.matches ? "dark" : "light");

      window.dispatchEvent(
        new CustomEvent("theme:changed", {
          detail: { theme: actualTheme.value },
        }),
      );
    }
  };

  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme && ["light", "dark", "auto"].includes(savedTheme)) {
      currentTheme.value = savedTheme as ThemeMode;
    }

    mediaQuery.value = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark.value = mediaQuery.value.matches;

    const changeHandler = handleSystemThemeChange;
    mediaQuery.value.addEventListener("change", changeHandler);

    globalResourceManager.registerEventListener(
      "system-theme-change",
      mediaQuery.value as MediaQueryList,
      "change",
      changeHandler as EventListener,
    );

    applyThemeToDOM(actualTheme.value);
  };

  const cleanup = () => {
    if (mediaQuery.value) {
      mediaQuery.value.removeEventListener("change", handleSystemThemeChange);
      mediaQuery.value = null;
    }
  };

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
