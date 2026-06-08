import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { SnapshotUser } from "@ieta-dyna-snapshot/shared";
import { authApi } from "@/services/api";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem("snapshot_auth_token"));
  const currentUser = ref<SnapshotUser | null>(null);
  const loading = ref(false);
  const isAuthenticated = computed(() => !!token.value && !!currentUser.value);

  const setToken = (value: string | null) => {
    token.value = value;
    if (value) localStorage.setItem("snapshot_auth_token", value);
    else localStorage.removeItem("snapshot_auth_token");
  };

  const login = async (username: string, password: string) => {
    loading.value = true;
    try {
      const response = await authApi.login({ username, password });
      setToken(response.accessToken);
      currentUser.value = response.user;
      return true;
    } finally {
      loading.value = false;
    }
  };

  const initializeAuth = async () => {
    if (!token.value) return;
    try {
      currentUser.value = await authApi.me();
    } catch {
      setToken(null);
      currentUser.value = null;
    }
  };

  const logout = () => {
    setToken(null);
    currentUser.value = null;
  };

  return { token, currentUser, loading, isAuthenticated, login, initializeAuth, logout };
});
