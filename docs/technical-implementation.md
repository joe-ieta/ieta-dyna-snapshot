# Technical Implementation

This document describes the active implementation baseline for `ieta-dyna-snapshot`.

## 1. Top-Level Platform Constraint

The system must run on Windows x64 and Linux ARM64.

Engineering consequences:

- Runtime code stays in Node.js/TypeScript.
- Use cross-platform Node APIs for paths, process execution, and file IO.
- Avoid OS-specific shell scripts in product flows.
- Keep generated assets under configurable local directories.
- Use Playwright Chromium for browser automation.
- Provide `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` so Linux ARM deployments can use a system Chromium when needed.
- Treat browser binary installation as a host provisioning step, not as hidden application logic.

## 2. Active Stack

- Runtime: Node.js 20+.
- Package manager: pnpm workspace.
- API: NestJS.
- Authentication: JWT with local seeded administrator.
- Authorization: permission decorators and guards.
- Persistence: TypeORM with sql.js for the current single-machine baseline.
- Browser automation: Playwright Chromium.
- Web console: Vue 3, Element Plus, Pinia, Vue Router, Axios.
- Shared contracts: `packages/shared` TypeScript types.
- Asset storage: local file system.

The earlier Fastify/React/Drizzle proposal is not the active implementation path.

## 3. Runtime Layout

```text
apps/
  api/
    src/
      database/
      modules/
        capture-worker/
        projects/
        security/
  web/
    src/
      layout/
      modules/
      router/
      services/
packages/
  shared/
data/
  app.db
  assets/
  browser-profiles/
```

## 4. Capture Execution

The MVP capture worker executes hand-written JSON capture plans.

Supported step types:

- `goto`
- `fill`
- `selectOption`
- `click`
- `waitForSelector`
- `screenshotPage`
- `screenshotElement`
- `extractTable`

Step retry policy:

```json
{
  "id": "wait-chart",
  "type": "waitForSelector",
  "selector": "#chart",
  "timeoutMs": 1000,
  "retry": {
    "attempts": 3,
    "delayMs": 500,
    "backoffMs": 250
  }
}
```

`POST /api/v1/capture-runs` currently creates the run, creates pending step rows, executes the selected plans synchronously, updates run and step status, writes assets, and returns the final run state.

Execution uses Playwright persistent browser contexts per business system. If an interactive session is already open, the worker reuses that context; otherwise it launches a temporary persistent context from the same profile path and closes it after the run.

Browser profile path:

```text
data/browser-profiles/{projectCode}/{systemCode}
```

Session policy example:

```json
{
  "loginCheck": {
    "urlIncludes": "/dashboard",
    "selector": ".user-avatar",
    "text": "",
    "timeoutMs": 5000
  }
}
```

When `loginCheck` is configured, automated runs validate the session before executing plan steps. Validation failure marks the run as failed with `LOGIN_REQUIRED`.

## 5. DOM Marking and Parameterization

DOM marking is attached to the interactive browser session for a business system. It does not run inside temporary automation pages.

Current behavior:

- `POST /api/v1/external-systems/{id}/marking/start` opens or reuses the interactive browser session and injects the marker script.
- Hovering elements in the business-system browser draws a non-interactive overlay.
- Clicking an element prevents the page click and stores a DOM selection in the API process memory for that active session.
- Stored selections include URL, page title, element kind, text/label, attributes, bounding box, selector candidates, recommended capture steps, and recommended input parameters.
- `POST /api/v1/external-systems/{id}/marking/scan-inputs` scans visible inputs in the current page and returns generated input schema plus `fill`/`selectOption` steps.
- Password inputs are marked as secure parameters and omit value previews.

Selector candidate sources:

- `data-testid`, `data-test`, and `data-qa`
- element ID
- element name
- aria label
- visible text
- relative CSS path fallback

Marking results are currently copyable JSON snippets in the Business Systems page. Persisted plan-draft editing remains a later task.

## 6. Diagnostics

When a step fails after all retry attempts, the worker records:

- current URL
- retry attempts and retry policy
- normalized error code and masked error message
- selector diagnostics when the step has a selector
- failure screenshot asset reference when screenshot capture succeeds

Selector diagnostics include:

- matched element count
- up to five sample nodes
- sample visibility flags
- sample bounding boxes
- text previews
- selector parse or query errors

Failure screenshots are stored as normal image assets with `metadata.diagnostic=true` and file names like:

```text
{assetRoot}/{yyyyMMdd}/{runId}/{stepId}-failure.png
```

Parameters marked `secure: true`, `type: "password"`, or sensitive key names such as `password`, `token`, `secret`, and `apiKey` are masked in parameter snapshots and failure diagnostics.

## 7. Security

Authentication supports:

- JWT bearer tokens for web operators.
- `X-API-Token` or `X-Snapshot-API-Token` for external automation callers.

API token permissions are intentionally limited to:

- `snapshot:project:read`
- `snapshot:plan:read`
- `snapshot:run:execute`
- `snapshot:asset:read`

For local-only operation, the default `API_HOST=127.0.0.1` remains valid. If `API_HOST` is set to a non-local address, startup refuses to continue unless:

- `JWT_SECRET` is at least 32 characters and is not `local-dev-secret`.
- `SNAPSHOT_API_TOKEN` or `SNAPSHOT_API_TOKENS` contains at least one token of at least 24 characters.

Production web builds do not prefill or display the default admin credentials. Development builds keep the local hint unless `VITE_SHOW_DEFAULT_LOGIN_HINT` is changed.

## 8. Asset Storage

Assets are written under the configured project asset root:

```text
{assetRoot}/{yyyyMMdd}/{runId}/{stepId}.{ext}
```

Each asset stores:

- unique asset code
- project ID
- run ID
- plan ID
- step ID
- content type
- content hash
- source URL
- selector snapshot
- parameter snapshot
- metadata

Current output formats:

- PNG for screenshots.
- JSON and CSV for extracted tables.

## 9. External API Surface

Primary endpoints:

- `GET /api/v1/projects/{projectCode}/inputs`
- `GET /api/v1/external-systems/{id}/session`
- `POST /api/v1/external-systems/{id}/session/open`
- `POST /api/v1/external-systems/{id}/session/refresh`
- `DELETE /api/v1/external-systems/{id}/session`
- `GET /api/v1/external-systems/{id}/marking`
- `POST /api/v1/external-systems/{id}/marking/start`
- `POST /api/v1/external-systems/{id}/marking/stop`
- `DELETE /api/v1/external-systems/{id}/marking/selections`
- `POST /api/v1/external-systems/{id}/marking/scan-inputs`
- `POST /api/v1/capture-runs`
- `GET /api/v1/capture-runs/{id}`
- `GET /api/v1/capture-runs/{id}/steps`
- `GET /api/v1/assets`
- `GET /api/v1/assets/{id}/content`
- `GET /api/v1/assets/{id}/download`

External callers merge their runtime parameters with project defaults through the trigger request.

See [External API Guide](external-api-guide.md) for cURL examples.

## 10. Browser Installation

Install Playwright Chromium on each host:

```bash
pnpm browser:install
```

For Linux ARM64 hosts that use a system Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm dev
```

The exact browser package name is distribution-specific and should be handled by deployment documentation for the target device.

## 11. Current Smoke Verification

The API package includes a smoke test:

```bash
pnpm --filter @ieta-dyna-snapshot/api smoke:capture
```

It starts a local fixture page, creates a project/system/plan through the service layer, runs Playwright, captures one DOM screenshot, extracts one table, and verifies PNG, JSON, and CSV assets.

It also verifies retry diagnostics, selector failure diagnostics, failure screenshot assets, and secure-value masking.

The API package also includes a security smoke test:

```bash
pnpm --filter @ieta-dyna-snapshot/api smoke:security
```

It starts a local Nest app on an ephemeral port and verifies missing, invalid, and valid API token behavior.
