import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { snapshotApi } from "@/services/api";

export const useAppStore = defineStore("app", () => {
  const loading = ref(false);
  const systemHealth = ref({
    status: "unknown",
    errorCount: 0,
    lastCheck: "",
  });

  const isHealthy = computed(() => systemHealth.value.status === "ok");

  const refreshData = async () => {
    loading.value = true;
    try {
      const health = await snapshotApi.health();
      systemHealth.value = {
        status: health.status,
        errorCount: health.status === "ok" ? 0 : 1,
        lastCheck: health.timestamp,
      };
    } finally {
      loading.value = false;
    }
  };

  return { loading, systemHealth, isHealthy, refreshData };
});
