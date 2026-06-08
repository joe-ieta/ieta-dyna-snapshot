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

export type RunStepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export type AssetType = "image" | "table" | "json" | "text" | "html" | "log";

export type CaptureStepType =
  | "goto"
  | "fill"
  | "selectOption"
  | "click"
  | "waitForSelector"
  | "screenshotPage"
  | "screenshotElement"
  | "extractTable";

export type DomElementKind =
  | "container"
  | "image"
  | "table"
  | "input"
  | "select"
  | "button"
  | "link"
  | "text"
  | "unknown";

export interface SelectorCandidate {
  type: "css" | "xpath" | "role" | "text" | "testId" | "relative";
  value: string;
  priority: number;
  stabilityScore?: number;
}

export interface CaptureStepDefinition {
  id: string;
  name: string;
  type: CaptureStepType;
  selector?: string;
  selectorCandidates?: SelectorCandidate[];
  url?: string;
  value?: unknown;
  valueRef?: string;
  valueLiteral?: unknown;
  parameter?: string;
  timeoutMs?: number;
  fullPage?: boolean;
  outputRef?: string;
  retry?: {
    attempts?: number;
    delayMs?: number;
    backoffMs?: number;
  };
  retryAttempts?: number;
  retryDelayMs?: number;
  metadata?: Record<string, unknown>;
}

export interface InputParameterDefinition {
  name: string;
  label: string;
  type: "string" | "password" | "number" | "date" | "boolean" | "select";
  required: boolean;
  secure: boolean;
  defaultValue?: unknown;
  allowedValues?: Array<{ label: string; value: string }>;
  validationRule?: string;
}

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  assetRoot: string;
  defaultParameters?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalSystemSummary {
  id: string;
  projectId: string;
  code: string;
  name: string;
  baseUrl: string;
  loginUrl?: string;
  browserProfileId: string;
  sessionPolicy: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DomElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DomElementAttributes {
  id?: string;
  name?: string;
  type?: string;
  role?: string;
  placeholder?: string;
  ariaLabel?: string;
  title?: string;
  testId?: string;
  className?: string;
  href?: string;
  valuePreview?: string;
}

export interface DomMarkingSelection {
  id: string;
  sequence: number;
  url: string;
  pageTitle: string;
  capturedAt: string;
  tagName: string;
  kind: DomElementKind;
  selector: string;
  selectorCandidates: SelectorCandidate[];
  label?: string;
  text?: string;
  attributes: DomElementAttributes;
  rect: DomElementRect;
  recommendedSteps: CaptureStepDefinition[];
  recommendedParameters: InputParameterDefinition[];
  metadata?: Record<string, unknown>;
}

export interface DomMarkingStatus {
  projectCode: string;
  systemCode: string;
  active: boolean;
  profilePath: string;
  currentUrl?: string;
  startedAt?: string;
  stoppedAt?: string;
  lastSelectionAt?: string;
  selectionCount: number;
  selections: DomMarkingSelection[];
}

export interface DomInputScanResult {
  projectCode: string;
  systemCode: string;
  url: string;
  scannedAt: string;
  selections: DomMarkingSelection[];
  parameters: InputParameterDefinition[];
  fillSteps: CaptureStepDefinition[];
}

export interface BrowserSessionStatus {
  projectCode: string;
  systemCode: string;
  profilePath: string;
  active: boolean;
  profileExists: boolean;
  loginState: "not_configured" | "unknown" | "valid" | "invalid";
  lastUrl?: string;
  startedAt?: string;
  lastCheckedAt?: string;
  message?: string;
}

export interface CapturePlanSummary {
  id: string;
  projectId: string;
  externalSystemId: string;
  code: string;
  name: string;
  description?: string;
  steps: CaptureStepDefinition[];
  inputSchema: InputParameterDefinition[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureRunSummary {
  id: string;
  projectId: string;
  status: CaptureRunStatus;
  requestedPlanIds: string[];
  requestedPlanCodes: string[];
  inputSnapshot: Record<string, unknown>;
  source: string;
  startedAt?: string;
  finishedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface RunStepSummary {
  id: string;
  runId: string;
  planId: string;
  stepId: string;
  sequence: number;
  stepName: string;
  stepType: string;
  status: RunStepStatus;
  startedAt?: string;
  finishedAt?: string;
  errorCode?: string;
  message?: string;
  diagnostics: Record<string, unknown>;
  createdAt: string;
}

export interface AssetSummary {
  id: string;
  assetCode: string;
  projectId: string;
  runId: string;
  planId: string;
  stepId: string;
  type: AssetType;
  title: string;
  filePath: string;
  contentType: string;
  contentHash: string;
  sourceUrl: string;
  selectorSnapshot: Record<string, unknown>;
  parameterSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectInputsResponse {
  projectCode: string;
  projectDefaults: Record<string, unknown>;
  parameters: InputParameterDefinition[];
  plans: Array<{
    code: string;
    name: string;
    requiredParameters: string[];
  }>;
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
