import axios from "axios";
import type { LoginResponse, ProjectSummary } from "@ieta-dyna-snapshot/shared";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("snapshot_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Request-ID"] =
    `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("snapshot_auth_token");
      window.dispatchEvent(new CustomEvent("snapshot:logout"));
    }
    return Promise.reject({
      status: error.response?.status,
      code: error.response?.data?.code || "API_ERROR",
      message: error.response?.data?.message || error.message || "请求失败",
    });
  },
);

export const authApi = {
  login(payload: { username: string; password: string }) {
    return api.post<unknown, LoginResponse>("/auth/login", payload);
  },
  me() {
    return api.get<unknown, LoginResponse["user"]>("/auth/me");
  },
};

export const snapshotApi = {
  listProjects() {
    return api.get<unknown, ProjectSummary[]>("/v1/projects");
  },
  createProject(payload: Partial<ProjectSummary>) {
    return api.post<unknown, ProjectSummary>("/v1/projects", payload);
  },
  listSystems(projectId?: string) {
    return api.get<unknown, any[]>("/v1/external-systems", { params: { projectId } });
  },
  listPlans(projectId?: string) {
    return api.get<unknown, any[]>("/v1/capture-plans", { params: { projectId } });
  },
  listRuns(projectId?: string) {
    return api.get<unknown, any[]>("/v1/capture-runs", { params: { projectId } });
  },
  triggerRun(payload: {
    projectCode: string;
    planCodes?: string[];
    parameters?: Record<string, unknown>;
  }) {
    return api.post<unknown, any>("/v1/capture-runs", payload);
  },
  listAssets(runId?: string) {
    return api.get<unknown, any[]>("/v1/assets", { params: { runId } });
  },
  health() {
    return api.get<unknown, { status: string; timestamp: string }>("/health");
  },
};

export default api;
