export type SnapshotPermission =
  | "snapshot:project:read"
  | "snapshot:project:write"
  | "snapshot:plan:read"
  | "snapshot:plan:write"
  | "snapshot:run:execute"
  | "snapshot:asset:read"
  | "snapshot:system:admin";

export type CaptureRunStatus =
  | "pending"
  | "running"
  | "waiting_for_manual_action"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AssetType = "image" | "table" | "json" | "text" | "html" | "log";

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  assetRoot: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: SnapshotPermission[];
}

export interface LoginResponse {
  accessToken: string;
  user: SnapshotUser;
}
