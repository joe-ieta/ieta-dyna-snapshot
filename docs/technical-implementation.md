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
- `click`
- `waitForSelector`
- `screenshotPage`
- `screenshotElement`
- `extractTable`

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

## 5. Asset Storage

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

## 6. External API Surface

Primary endpoints:

- `GET /api/v1/projects/{projectCode}/inputs`
- `GET /api/v1/external-systems/{id}/session`
- `POST /api/v1/external-systems/{id}/session/open`
- `POST /api/v1/external-systems/{id}/session/refresh`
- `DELETE /api/v1/external-systems/{id}/session`
- `POST /api/v1/capture-runs`
- `GET /api/v1/capture-runs/{id}`
- `GET /api/v1/capture-runs/{id}/steps`
- `GET /api/v1/assets`
- `GET /api/v1/assets/{id}/content`
- `GET /api/v1/assets/{id}/download`

External callers merge their runtime parameters with project defaults through the trigger request.

## 7. Browser Installation

Install Playwright Chromium on each host:

```bash
pnpm browser:install
```

For Linux ARM64 hosts that use a system Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm dev
```

The exact browser package name is distribution-specific and should be handled by deployment documentation for the target device.

## 8. Current Smoke Verification

The API package includes a smoke test:

```bash
pnpm --filter @ieta-dyna-snapshot/api smoke:capture
```

It starts a local fixture page, creates a project/system/plan through the service layer, runs Playwright, captures one DOM screenshot, extracts one table, and verifies PNG, JSON, and CSV assets.
