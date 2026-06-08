# Development Workflow

This document is the primary execution route for `ieta-dyna-snapshot`. It selectively absorbs the review findings from `project-review-and-development-recommendations.md` according to the current running baseline.

## 1. Current Position

The project now has a running application framework:

- NestJS API with JWT login, permissions, TypeORM/sql.js persistence, and seeded local admin.
- Vue 3 + Element Plus console with menu layout, login guard, Pinia stores, theme toggle, and Axios wrapper.
- Base APIs and entities for projects, external systems, capture plans, capture runs, and assets.
- `pnpm.cmd type-check` and `pnpm.cmd build` pass.

The project does not yet have the product-critical capture loop:

- no Playwright worker
- no browser profile/session reuse
- no real capture plan execution
- no screenshot/table asset generation
- no asset download/content API
- no run step diagnostics

The next work must therefore close one real capture vertical slice before broad UI polish.

## 2. Selective Review Absorption

### Adopt Immediately

These review recommendations directly affect the first capture slice and should be implemented now:

- Replace loose `payload: any` API contracts with DTOs for the endpoints used by the first slice.
- Reject invalid project/system/plan/run payloads early with stable 4xx responses.
- Reject missing plan codes explicitly instead of silently filtering them.
- Add the trace fields required for execution and assets:
  - run start/finish/error fields
  - asset plan ID, step ID, content type, source URL, selector snapshot, parameter snapshot, content hash
- Add `run_steps` because capture debugging is impossible without step-level status.
- Add asset code allocation before writing real assets.
- Add Playwright worker and make `POST /api/v1/capture-runs` execute a hand-written plan.
- Add asset file writing and download/content APIs.

### Adopt After First Capture Slice

These are important, but should not block the first real capture proof:

- Full CRUD polish for every management page.
- Full plan versioning UI.
- Full role/user/permission management UI.
- Browser session reuse and manual login workflow.
- DOM marker, selector generation UI, and operation recording.
- Security hardening for non-local deployment.
- Extensive fixture integration test suite.

### Defer for Later

These should be revisited after the capture engine stabilizes:

- Turning off TypeORM `synchronize` and introducing formal migrations.
- Multi-user deployment concerns.
- Advanced selector repair.
- Scheduling, distributed workers, object storage, and report-generation integration.

## 3. Near-Term Milestone: MVP Capture Slice

The immediate milestone is:

> From a saved project and hand-written JSON capture plan, trigger a run through API, open a browser, capture one screenshot and one table, store files, create asset records, and make the assets downloadable.

This milestone proves the product value and gives the UI a real backend path to operate.

## 4. Stage 0: Baseline Stabilization

### Goal

Keep the current application framework stable and aligned before capture engine work starts.

### Tasks

1. Keep `pnpm-lock.yaml` committed with the current workspace.
2. Keep generated outputs ignored:
   - `node_modules`
   - `.pnpm-store`
   - `dist`
   - `data`
   - `logs`
3. Ensure API dev output resolves to `apps/api/dist/main.js`.
4. Update `docs/technical-implementation.md` enough to state the actual chosen stack:
   - NestJS
   - TypeORM/sql.js
   - Vue 3
   - Element Plus
   - Pinia
   - Axios
   - Playwright for capture

### Acceptance Criteria

- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.
- API and Web dev servers start on `4310` and `4311`.
- Documentation no longer suggests a parallel Fastify/React/Drizzle implementation path as the active baseline.

## 5. Stage 1: Minimal Contracts and Trace Model

### Goal

Harden only the API contracts and data fields needed by the MVP capture slice.

### Tasks

1. Add DTOs for:
   - create/update project
   - create/update external system
   - create/update capture plan
   - trigger capture run
2. Add validation for:
   - project code
   - system code
   - plan code
   - URL fields
   - capture step array
   - runtime parameter object
3. Add stable error response fields:
   - `code`
   - `message`
   - `details`
4. Add or extend entities:
   - `run_steps`
   - `asset_sequences`
   - richer `capture_runs`
   - richer `assets`
5. Add transaction boundaries for:
   - run creation
   - run status updates
   - asset code allocation
   - asset metadata creation

### Acceptance Criteria

- Current APIs no longer depend on raw `payload: any` for the first slice.
- Invalid trigger requests fail before a run is created.
- Missing project or plan codes return stable error codes.
- Run and asset models contain the fields needed for execution traceability.
- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.

## 6. Stage 2: Playwright Capture Worker

### Goal

Execute a hand-written JSON capture plan and produce real local files.

### Tasks

1. Add Playwright dependency to `apps/api`.
2. Add `CaptureWorkerModule`.
3. Define supported MVP steps:
   - `goto`
   - `fill`
   - `click`
   - `waitForSelector`
   - `screenshotPage`
   - `screenshotElement`
   - `extractTable`
4. Implement step executor.
5. Implement selector resolution for CSS selectors first.
6. Implement run status transition:
   - `pending`
   - `running`
   - `succeeded`
   - `failed`
7. Implement `run_steps` writes for each step.
8. Write assets under:
   - `data/assets/{projectCode}/{yyyyMMdd}/{runId}`
9. Store screenshot assets as PNG.
10. Store table assets as JSON and CSV.
11. Calculate content hash.
12. Persist asset metadata.
13. Add asset download and structured content endpoints.

### Acceptance Criteria

- `POST /api/v1/capture-runs` executes a selected plan, not only creates a pending record.
- A fixture or simple local page can produce one image asset.
- A fixture or simple local page can produce one table data asset.
- Run detail includes step statuses.
- Assets can be listed and downloaded.
- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.

## 7. Stage 3: Minimal Operator UI for the Capture Slice

### Goal

Expose the working capture slice through the current console without building the visual recorder yet.

### Tasks

1. Add project selector to relevant pages.
2. Turn Project page into basic CRUD.
3. Turn Business Systems page into basic CRUD.
4. Add JSON capture plan editor.
5. Add manual run trigger form:
   - project code
   - plan codes
   - runtime parameters JSON
6. Add run detail page:
   - status
   - input snapshot
   - timings
   - step list
   - error message
7. Add asset preview/download actions.
8. Replace static dashboard counters with API-backed counters.

### Acceptance Criteria

- A local operator can configure a JSON plan and run it from the UI.
- A local operator can inspect run steps.
- A local operator can preview/download generated assets.
- The UI remains focused on the MVP capture path.
- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.

## 8. Stage 4: Browser Session Reuse

### Goal

Support the intended local workflow: manual login once, then reuse the saved browser session.

### Tasks

1. Add browser profile path convention:
   - `data/browser-profiles/{projectCode}/{systemCode}`
2. Add interactive browser session API.
3. Launch Playwright persistent context for a project/system.
4. Add login-check rules:
   - URL pattern
   - selector exists
   - selector text
5. Add session status, clear, and refresh APIs.
6. Add session controls to Business Systems page.
7. Make headless runs fail with `LOGIN_REQUIRED` when session validation fails.

### Acceptance Criteria

- User can open a managed browser session.
- User can manually log in and reuse the saved profile.
- Expired sessions produce actionable diagnostics.
- Browser profiles are isolated by project/system.
- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.

## 9. Stage 5: DOM Marking and Parameterization

### Goal

Make plan authoring easier after the JSON execution path is stable.

### Tasks

1. Add marking session API.
2. Inject DOM element picker script.
3. Highlight hovered DOM elements.
4. Generate selector candidates:
   - data attributes
   - stable ID
   - role/name
   - CSS path
   - text selector
   - XPath fallback
5. Save selected screenshot/data targets into plan draft JSON.
6. Record simple operations:
   - navigation
   - click
   - fill
   - select
   - check
   - press
7. Detect input labels/placeholders/names.
8. Convert recorded values into parameters.
9. Implement runtime parameter merge:
   - external API values
   - manual run values
   - plan defaults
   - project defaults
   - secure values
10. Mask secure values in logs and responses.

### Acceptance Criteria

- User can select a DOM screenshot target and save executable plan JSON.
- User can select a table/data target and save executable plan JSON.
- Recorded inputs can be parameterized and re-run with different values.
- Secure parameters are masked.
- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.

## 10. Stage 6: Diagnostics, Security, and Tests

### Goal

Make the system maintainable for real business pages.

### Tasks

1. Add selector failure diagnostics:
   - attempted selectors
   - current URL
   - page title
   - timeout reason
2. Add failure screenshots.
3. Add retry policy per step.
4. Add local fixture app/integration tests.
5. Add unit tests for:
   - parameter merge
   - asset code allocation
   - selector ordering
   - capture plan validation
6. Add API token support for non-local exposure.
7. Refuse non-local host startup unless API token and strong JWT secret are configured.
8. Remove default password prefill from production builds.
9. Add external caller guide and Swagger examples.

### Acceptance Criteria

- Failed runs identify the exact failed step.
- Selector failures include enough context to repair the plan.
- Failure screenshots are saved as diagnostic assets.
- Integration tests prove screenshot and table extraction.
- External callers can query inputs, trigger runs, poll status, and download assets.
- Non-local exposure has explicit security guardrails.
- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.

## 11. Verification Checklist

Run before finishing any stage:

```bash
pnpm.cmd type-check
pnpm.cmd build
```

Also verify:

- No generated `.js` files under `src/`.
- No `node_modules`, `.pnpm-store`, `dist`, `data`, or `logs` files staged for commit.
- API starts without missing `dist/main.js`.
- Web dev server opens at `http://127.0.0.1:4311`.
- API docs open at `http://127.0.0.1:4310/api/docs`.
- New APIs are visible in Swagger.
- Security-sensitive values are masked in logs and responses.

## 12. Commit Guidance

Use small commits per stage or sub-stage. Recommended commit message style:

```text
Harden MVP capture contracts
Add Playwright capture worker
Implement asset file writer
Add JSON plan execution UI
```

Do not mix unrelated UI polish with capture engine changes unless the UI is required to verify the current vertical slice.
