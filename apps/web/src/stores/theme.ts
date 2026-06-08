import { defineStore } from "pinia";
import { computed, ref } from "vue";

export type ThemeMode = "light" | "dark";

export const useThemeStore = defineStore("theme", () => {
  const mode = ref<ThemeMode>((localStorage.getItem("snapshot_theme") as ThemeMode) || "light");
  const isDark = computed(() => mode.value === "dark");

  const applyTheme = () => {
    document.documentElement.classList.toggle("dark", isDark.value);
    document.body.classList.toggle("dark", isDark.value);
  };

  const setTheme = (next: ThemeMode) => {
    mode.value = next;
    localStorage.setItem("snapshot_theme", next);
    applyTheme();
  };

  const toggleTheme = () => setTheme(isDark.value ? "light" : "dark");
  const initialize = () => applyTheme();

  return { mode, isDark, setTheme, toggleTheme, initialize };
});
