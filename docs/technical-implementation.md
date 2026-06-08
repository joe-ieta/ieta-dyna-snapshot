# Web Snapshot and Data Capture Technical Implementation Plan

## 1. Recommended Stack

Version 1 should use a pragmatic Node.js stack:

- Runtime: Node.js LTS.
- Language: TypeScript.
- HTTP server: Fastify.
- Browser automation: Playwright.
- Database: SQLite for local deployment.
- ORM/query layer: Drizzle ORM.
- Validation: Zod.
- UI: React + Vite.
- Asset files: local file system.
- Image handling: Sharp where post-processing is needed.
- CSV export: csv-stringify.
- XLSX export later: xlsx.
- Logging: pino.
- Job execution: in-process queue for version 1.

The initial implementation should avoid distributed queues and object storage. Those can be introduced after the capture model is proven.

## 2. Repository Layout

Recommended monorepo layout:

```text
/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  apps/
    server/
      src/
        api/
        capture/
        db/
        domain/
        services/
        storage/
        workers/
        main.ts
    web/
      src/
        pages/
        components/
        api/
        marking/
        main.tsx
  packages/
    shared/
      src/
        schemas/
        types/
  data/
    app.db
    assets/
    browser-profiles/
    secrets/
  docs/
```

The `packages/shared` package should contain shared TypeScript types and Zod schemas used by both the server and UI.

## 3. Configuration

Use a typed configuration file plus environment overrides.

```text
SNAPSHOT_HOST=127.0.0.1
SNAPSHOT_PORT=4310
SNAPSHOT_DATA_DIR=./data
SNAPSHOT_API_TOKEN=
SNAPSHOT_BROWSER_HEADLESS_DEFAULT=true
SNAPSHOT_SECRET_KEY_FILE=./data/secrets/key.bin
```

The service should refuse to bind to non-local addresses unless `SNAPSHOT_API_TOKEN` is configured.

## 4. Database Tables

### 4.1 projects

```sql
id text primary key,
code text not null unique,
name text not null,
description text,
asset_root text not null,
asset_code_rule text not null,
default_parameters_json text not null,
created_at text not null,
updated_at text not null
```

### 4.2 external_systems

```sql
id text primary key,
project_id text not null,
code text not null,
name text not null,
base_url text not null,
login_url text,
browser_profile_id text not null,
session_policy_json text not null,
login_check_rule_json text,
default_viewport_json text not null,
created_at text not null,
updated_at text not null,
unique(project_id, code)
```

### 4.3 capture_plans

```sql
id text primary key,
project_id text not null,
external_system_id text not null,
code text not null,
name text not null,
description text,
current_version_id text,
enabled integer not null,
created_at text not null,
updated_at text not null,
unique(project_id, code)
```

### 4.4 capture_plan_versions

```sql
id text primary key,
capture_plan_id text not null,
version integer not null,
steps_json text not null,
input_schema_json text not null,
target_definitions_json text not null,
created_at text not null,
unique(capture_plan_id, version)
```

### 4.5 capture_runs

```sql
id text primary key,
project_id text not null,
status text not null,
requested_plan_ids_json text not null,
input_snapshot_json text not null,
source text not null,
requested_by text,
started_at text,
finished_at text,
error_code text,
error_message text,
created_at text not null
```

### 4.6 run_steps

```sql
id text primary key,
run_id text not null,
plan_id text not null,
step_id text not null,
status text not null,
started_at text,
finished_at text,
message text,
diagnostics_json text
```

### 4.7 assets

```sql
id text primary key,
asset_code text not null unique,
project_id text not null,
run_id text not null,
plan_id text,
step_id text,
type text not null,
title text not null,
file_path text not null,
content_type text not null,
content_hash text not null,
source_url text,
selector_snapshot_json text,
parameter_snapshot_json text not null,
metadata_json text not null,
created_at text not null
```

### 4.8 asset_sequences

```sql
project_id text not null,
date_key text not null,
asset_type text not null,
next_value integer not null,
primary key(project_id, date_key, asset_type)
```

This table prevents duplicate asset numbers.

## 5. Shared Schemas

Use Zod schemas for capture plans and external API payloads.

### 5.1 Capture Step Schema

```ts
type CaptureStep =
  | GotoStep
  | ClickStep
  | FillStep
  | SelectStep
  | CheckStep
  | PressStep
  | WaitForSelectorStep
  | WaitForResponseStep
  | ScreenshotPageStep
  | ScreenshotElementStep
  | ExtractTableStep
  | ExtractTextStep
  | ExtractJsonFromResponseStep
  | AssertStep
  | ManualCheckpointStep;
```

Each step should include:

```ts
type BaseStep = {
  id: string;
  name: string;
  type: string;
  timeoutMs?: number;
  retry?: {
    attempts: number;
    delayMs: number;
  };
};
```

### 5.2 Selector Candidate Schema

```ts
type SelectorCandidate = {
  type: "css" | "xpath" | "role" | "text" | "testId" | "relative";
  value: string;
  priority: number;
  stabilityScore?: number;
};
```

### 5.3 Input Parameter Schema

```ts
type InputParameter = {
  name: string;
  label: string;
  type: "string" | "password" | "number" | "date" | "boolean" | "select";
  required: boolean;
  secure: boolean;
  defaultValue?: unknown;
  allowedValues?: Array<{ label: string; value: string }>;
  validationRule?: string;
};
```

## 6. Capture Worker Implementation

### 6.1 Browser Context

Use Playwright persistent contexts for session reuse:

```ts
const context = await chromium.launchPersistentContext(profilePath, {
  headless,
  viewport,
  deviceScaleFactor,
  acceptDownloads: true,
});
```

Profile path format:

```text
data/browser-profiles/{projectCode}/{systemCode}
```

This keeps cookies, localStorage, IndexedDB, and other browser state where supported by Chromium.

### 6.2 Step Executor

Implement a dispatcher:

```ts
async function executeStep(ctx: ExecutionContext, step: CaptureStep) {
  switch (step.type) {
    case "goto":
      return executeGoto(ctx, step);
    case "fill":
      return executeFill(ctx, step);
    case "screenshotElement":
      return executeScreenshotElement(ctx, step);
    case "extractTable":
      return executeExtractTable(ctx, step);
    default:
      throw new Error(`Unsupported step type: ${step.type}`);
  }
}
```

Every step should emit:

- start event
- success event
- failure event with diagnostics

### 6.3 Selector Resolution

Implement a selector resolver that tries candidates in order.

```ts
async function resolveLocator(page: Page, candidates: SelectorCandidate[]) {
  const ordered = [...candidates].sort((a, b) => a.priority - b.priority);

  for (const candidate of ordered) {
    const locator = createLocator(page, candidate);
    const count = await locator.count().catch(() => 0);
    if (count > 0 && await locator.first().isVisible().catch(() => false)) {
      return locator.first();
    }
  }

  throw new SelectorNotFoundError(candidates);
}
```

When selector resolution fails, diagnostics should include candidate list, current URL, page title, and optional screenshot.

### 6.4 Screenshot Element

```ts
const locator = await resolveLocator(page, step.selectorCandidates);
await locator.scrollIntoViewIfNeeded();
await waitForElementStable(locator);
await locator.screenshot({ path: outputPath });
```

The system should preserve:

- source URL
- selector candidates
- bounding box
- viewport
- asset code
- file hash

### 6.5 Full Page Screenshot

```ts
await page.screenshot({
  path: outputPath,
  fullPage: step.fullPage,
});
```

### 6.6 Table Extraction

Start with DOM table extraction:

```ts
const data = await locator.evaluate((table) => {
  const rows = Array.from(table.querySelectorAll("tr"));
  return rows.map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) =>
      (cell.textContent || "").trim()
    )
  );
});
```

For non-table repeated structures, support configured row and cell selectors:

```ts
type ExtractTableStep = {
  type: "extractTable";
  rootSelectorCandidates: SelectorCandidate[];
  rowSelector?: string;
  cellSelector?: string;
  headers?: string[];
  outputFormats: Array<"json" | "csv">;
};
```

### 6.7 Network JSON Extraction

For data loaded through APIs, allow matching response URLs:

```ts
const responsePromise = page.waitForResponse((response) =>
  response.url().includes(step.urlPattern) &&
  response.request().method() === "GET"
);

// Execute triggering steps before this wait if needed.
const response = await responsePromise;
const json = await response.json();
```

Version 1 should support explicit response capture steps. Automatic discovery can be added later.

## 7. Marking Mode Implementation

### 7.1 Element Picker

Inject a script into the controlled page:

- Track mouse hover target.
- Draw an overlay around the hovered element.
- On click, prevent default navigation if selection mode is active.
- Generate selector candidates for the selected element.
- Send selected element metadata to the Web Console.

Metadata should include:

- tag name
- id
- class list
- text sample
- role
- accessible name if available
- bounding box
- generated selector candidates

### 7.2 Selector Candidate Generation

Priority order:

1. `data-testid`, `data-test`, or equivalent test attributes.
2. Stable `id` if not generated.
3. ARIA role plus accessible name.
4. CSS selector based on stable class and parent path.
5. Text selector for buttons, links, labels.
6. XPath fallback.

Generated selectors must be editable in the UI.

### 7.3 Operation Recording

For version 1, operation recording should be intentionally limited:

- Record navigation.
- Record click.
- Record fill.
- Record select.
- Record checkbox/radio state changes.
- Let users review and edit recorded steps before saving.

Complex custom controls should be supported through manual step editing and manual checkpoints.

### 7.4 Parameter Discovery

When an input operation is recorded:

1. Generate a candidate parameter name from element name, label, placeholder, or nearby text.
2. Ask the user whether to keep it literal or convert it to a parameter.
3. Store mapping from parameter to step value reference.

Example:

```json
{
  "id": "fill-report-date",
  "type": "fill",
  "selectorCandidates": [
    { "type": "css", "value": "#reportDate", "priority": 1 }
  ],
  "valueRef": "parameters.report_date"
}
```

## 8. External API Implementation

### 8.1 Query Project Inputs

```http
GET /api/projects/{projectCode}/inputs
```

Response:

```json
{
  "projectCode": "RPT-OPS-202606",
  "parameters": [
    {
      "name": "report_date",
      "label": "Report date",
      "type": "date",
      "required": true,
      "secure": false
    },
    {
      "name": "org_code",
      "label": "Organization",
      "type": "select",
      "required": true,
      "secure": false,
      "allowedValues": [
        { "label": "Headquarters", "value": "HQ" }
      ]
    }
  ],
  "plans": [
    {
      "code": "sales-dashboard",
      "name": "Sales dashboard",
      "requiredParameters": ["report_date", "org_code"]
    }
  ]
}
```

### 8.2 Trigger Run

```http
POST /api/runs
```

Request:

```json
{
  "projectCode": "RPT-OPS-202606",
  "planCodes": ["sales-dashboard", "inventory-table"],
  "parameters": {
    "report_date": "2026-06-08",
    "org_code": "HQ"
  },
  "options": {
    "headless": true
  }
}
```

Response:

```json
{
  "runId": "run_01HX...",
  "status": "pending",
  "statusUrl": "/api/runs/run_01HX..."
}
```

### 8.3 Query Run

```http
GET /api/runs/{runId}
```

Response:

```json
{
  "runId": "run_01HX...",
  "status": "succeeded",
  "projectCode": "RPT-OPS-202606",
  "startedAt": "2026-06-08T04:30:00.000Z",
  "finishedAt": "2026-06-08T04:31:12.000Z",
  "assets": [
    {
      "assetCode": "RPT-OPS-202606-IMG-20260608-0001",
      "type": "image",
      "title": "Sales trend chart",
      "downloadUrl": "/api/assets/RPT-OPS-202606-IMG-20260608-0001/download"
    }
  ]
}
```

## 9. Parameter Merge Implementation

Use a deterministic merge function:

```ts
function mergeParameters(input: {
  secureValues: Record<string, unknown>;
  projectDefaults: Record<string, unknown>;
  planDefaults: Record<string, unknown>;
  manualValues?: Record<string, unknown>;
  runtimeValues?: Record<string, unknown>;
}) {
  return {
    ...input.secureValues,
    ...input.projectDefaults,
    ...input.planDefaults,
    ...input.manualValues,
    ...input.runtimeValues,
  };
}
```

Then validate against the merged input schema. Secure values should be masked after validation before persistence into non-secret run logs.

## 10. Asset Writing Implementation

Asset creation should be transactional at the metadata level:

1. Allocate asset code in database transaction.
2. Write file to temporary path.
3. Calculate content hash.
4. Move temporary file to final path.
5. Insert asset metadata.
6. Roll back metadata and clean temporary file if any step fails.

Recommended path:

```text
data/assets/{projectCode}/{yyyyMMdd}/{runId}/{type}/{assetCode}.{ext}
```

## 11. Error Handling

Use stable error codes:

- `PROJECT_NOT_FOUND`
- `PLAN_NOT_FOUND`
- `INPUT_VALIDATION_FAILED`
- `LOGIN_REQUIRED`
- `SESSION_EXPIRED`
- `SELECTOR_NOT_FOUND`
- `PAGE_READY_TIMEOUT`
- `CAPTURE_FAILED`
- `EXTRACTION_FAILED`
- `ASSET_WRITE_FAILED`
- `MANUAL_CHECKPOINT_REQUIRED`

Errors returned to API callers should include actionable diagnostics without leaking secure values.

## 12. MVP Build Order

### Milestone 1: Foundation

- Create TypeScript workspace.
- Add Fastify API server.
- Add SQLite/Drizzle schema.
- Add project CRUD.
- Add asset storage service.

### Milestone 2: Capture Execution

- Add Playwright worker.
- Add persistent browser profile support.
- Implement `goto`, `fill`, `click`, `waitForSelector`.
- Implement page and element screenshots.
- Implement table extraction.
- Store run and asset metadata.

### Milestone 3: External API

- Implement project input schema endpoint.
- Implement run trigger endpoint.
- Implement run status endpoint.
- Implement run asset list and download endpoints.
- Add API token guard for non-local exposure.

### Milestone 4: Web Console

- Add project and system management UI.
- Add manual run UI.
- Add asset browser.
- Add run log view.

### Milestone 5: Marking Mode

- Add controlled browser session API.
- Inject DOM element picker.
- Generate selector candidates.
- Save screenshot targets.
- Discover input parameters from recorded operations.
- Save capture plans from marking mode.

## 13. Testing Strategy

### 13.1 Unit Tests

- Parameter merge and validation.
- Asset code allocation.
- Selector candidate ordering.
- Capture plan schema validation.
- API request validation.

### 13.2 Integration Tests

Use a local fixture web app with:

- Login page.
- Dashboard page.
- Filter inputs.
- Chart-like DOM element.
- HTML table.
- JSON API endpoint.

Run Playwright against the fixture app to verify:

- Session persistence.
- Parameterized execution.
- Element screenshot.
- Table extraction.
- Asset metadata creation.

### 13.3 Manual Verification

Use at least one real target business system in interactive mode:

- Manual login.
- Save session.
- Mark DOM screenshot region.
- Mark structured data target.
- Re-run with changed parameters.

## 14. Implementation Risks and Mitigations

### 14.1 Unstable Selectors

Mitigation: store multiple selector candidates and expose selector editing.

### 14.2 Session Expiration

Mitigation: add login-check rules and manual re-login workflow.

### 14.3 Complex Custom Controls

Mitigation: allow manual checkpoints and editable steps.

### 14.4 Virtualized Tables

Mitigation: support screenshot fallback and explicit network JSON capture.

### 14.5 Sensitive Data Leakage

Mitigation: secure parameter flag, log masking, API token, localhost binding by default.

## 15. First Implementation Recommendation

Start with the external API and execution model before building a polished recorder. The most valuable first vertical slice is:

1. Define a project.
2. Define a capture plan in JSON.
3. Save or reuse a browser session.
4. Execute the plan through `POST /api/runs`.
5. Generate one element screenshot and one CSV/JSON table asset.
6. Query run status and download assets.

After this path is stable, build the marking UI to produce the same capture plan JSON automatically.
