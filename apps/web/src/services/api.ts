import axios from "axios";
import type {
  AssetSummary,
  BrowserSessionStatus,
  CapturePlanSummary,
  CaptureRunSummary,
  DomInputScanResult,
  DomMarkingStatus,
  ExternalSystemSummary,
  LoginResponse,
  ProjectInputsResponse,
  ProjectSummary,
  RunStepSummary,
} from "@ieta-dyna-snapshot/shared";

export type ApiError = {
  status?: number;
  code: string;
  message: string;
  details?: unknown;
};

const api = axios.create({
  baseURL: "/api",
  timeout: 120000,
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
      details: error.response?.data?.details,
    } satisfies ApiError);
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
  createProject(payload: {
    code: string;
    name: string;
    description?: string;
    assetRoot?: string;
    defaultParameters?: Record<string, unknown>;
  }) {
    return api.post<unknown, ProjectSummary>("/v1/projects", payload);
  },
  updateProject(id: string, payload: {
    name?: string;
    description?: string;
    assetRoot?: string;
    defaultParameters?: Record<string, unknown>;
  }) {
    return api.patch<unknown, ProjectSummary>(`/v1/projects/${id}`, payload);
  },
  getProjectInputs(projectCode: string) {
    return api.get<unknown, ProjectInputsResponse>(`/v1/projects/${projectCode}/inputs`);
  },
  listSystems(projectId?: string) {
    return api.get<unknown, ExternalSystemSummary[]>("/v1/external-systems", {
      params: { projectId },
    });
  },
  createSystem(payload: {
    projectId: string;
    code: string;
    name: string;
    baseUrl: string;
    loginUrl?: string;
    browserProfileId?: string;
    sessionPolicy?: Record<string, unknown>;
  }) {
    return api.post<unknown, ExternalSystemSummary>("/v1/external-systems", payload);
  },
  updateSystem(id: string, payload: {
    name?: string;
    baseUrl?: string;
    loginUrl?: string;
    sessionPolicy?: Record<string, unknown>;
  }) {
    return api.patch<unknown, ExternalSystemSummary>(`/v1/external-systems/${id}`, payload);
  },
  getSystemSession(id: string) {
    return api.get<unknown, BrowserSessionStatus>(`/v1/external-systems/${id}/session`);
  },
  openSystemSession(id: string) {
    return api.post<unknown, BrowserSessionStatus>(`/v1/external-systems/${id}/session/open`);
  },
  refreshSystemSession(id: string) {
    return api.post<unknown, BrowserSessionStatus>(`/v1/external-systems/${id}/session/refresh`);
  },
  clearSystemSession(id: string) {
    return api.delete<unknown, BrowserSessionStatus>(`/v1/external-systems/${id}/session`);
  },
  getDomMarkingStatus(id: string) {
    return api.get<unknown, DomMarkingStatus>(`/v1/external-systems/${id}/marking`);
  },
  startDomMarking(id: string, payload?: { clear?: boolean }) {
    return api.post<unknown, DomMarkingStatus>(`/v1/external-systems/${id}/marking/start`, payload || {});
  },
  stopDomMarking(id: string) {
    return api.post<unknown, DomMarkingStatus>(`/v1/external-systems/${id}/marking/stop`);
  },
  clearDomMarkingSelections(id: string) {
    return api.delete<unknown, DomMarkingStatus>(`/v1/external-systems/${id}/marking/selections`);
  },
  scanDomInputs(id: string) {
    return api.post<unknown, DomInputScanResult>(`/v1/external-systems/${id}/marking/scan-inputs`);
  },
  listPlans(projectId?: string) {
    return api.get<unknown, CapturePlanSummary[]>("/v1/capture-plans", {
      params: { projectId },
    });
  },
  createPlan(payload: {
    projectId: string;
    externalSystemId: string;
    code: string;
    name: string;
    description?: string;
    steps?: Record<string, unknown>[];
    inputSchema?: Record<string, unknown>[];
    enabled?: boolean;
  }) {
    return api.post<unknown, CapturePlanSummary>("/v1/capture-plans", payload);
  },
  updatePlan(id: string, payload: {
    name?: string;
    description?: string;
    steps?: Record<string, unknown>[];
    inputSchema?: Record<string, unknown>[];
    enabled?: boolean;
  }) {
    return api.patch<unknown, CapturePlanSummary>(`/v1/capture-plans/${id}`, payload);
  },
  listRuns(projectId?: string) {
    return api.get<unknown, CaptureRunSummary[]>("/v1/capture-runs", {
      params: { projectId },
    });
  },
  getRun(id: string) {
    return api.get<unknown, CaptureRunSummary>(`/v1/capture-runs/${id}`);
  },
  listRunSteps(runId: string) {
    return api.get<unknown, RunStepSummary[]>(`/v1/capture-runs/${runId}/steps`);
  },
  triggerRun(payload: {
    projectCode: string;
    planCodes?: string[];
    parameters?: Record<string, unknown>;
    source?: "manual" | "api";
  }) {
    return api.post<unknown, CaptureRunSummary>("/v1/capture-runs", payload);
  },
  listAssets(runId?: string) {
    return api.get<unknown, AssetSummary[]>("/v1/assets", { params: { runId } });
  },
  getAssetContent(id: string) {
    return api.get<unknown, unknown>(`/v1/assets/${id}/content`);
  },
  downloadAsset(id: string) {
    return api.get<unknown, Blob>(`/v1/assets/${id}/download`, {
      responseType: "blob",
    });
  },
  health() {
    return api.get<unknown, { status: string; timestamp: string }>("/health");
  },
};

export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default api;
