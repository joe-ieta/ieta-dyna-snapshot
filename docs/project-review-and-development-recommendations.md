# Project Review and Development Recommendations

## 1. Review Scope

This document records the architecture, design, technical-framework, and code-implementation review for the current `ieta-dyna-snapshot` baseline. It should be read as an independent review and planning line after the product requirements, architecture, technical implementation plan, and application framework baseline.

The review uses the current repository state as the source of truth:

- Product target: local web snapshot and structured data capture.
- Version boundary: single-machine deployment, local browser control, manual-login session reuse, capture plans, screenshot/data assets, and external HTTP trigger APIs.
- Current implementation: NestJS API, TypeORM/sql.js persistence, Vue 3 + Element Plus console, shared TypeScript types, JWT login, and basic project/run/asset management APIs.

## 2. Overall Assessment

The current project is a compilable foundation application framework. It is not yet a runnable capture-system MVP.

The implemented framework is useful: it establishes a monorepo, local API service, frontend console shell, authentication, permissions, base persistence, route/menu structure, and initial resource entities. However, the value chain described by the requirements is not closed yet. A user can create basic management records, but the system cannot yet open a controlled browser session, reuse a saved login, execute a capture plan, capture screenshots or tables, write asset files, expose asset downloads, or produce step-level run diagnostics.

The next development phase should therefore focus on one end-to-end capture vertical slice before adding more management UI polish.

## 3. Major Findings

### 3.1 Capture Core Is Missing

The requirements define browser control, session reuse, screenshot capture, structured data extraction, unique asset creation, and external run triggering as first-version goals. The current backend only creates a `pending` run record when a capture run is triggered. It does not execute plan steps, does not call Playwright, does not write asset files, and does not transition run status.

Impact:

- Version 1 acceptance criteria cannot be met.
- External API callers receive a run record, but no capture work happens.
- The asset library remains metadata-only and cannot prove the product value.

Recommendation:

- Add a `CaptureWorkerModule` with Playwright as the first product-critical module.
- Support a minimal step set first: `goto`, `fill`, `click`, `waitForSelector`, `screenshotPage`, `screenshotElement`, and `extractTable`.
- Make `POST /api/v1/capture-runs` execute a selected hand-written JSON plan before building visual recording.

### 3.2 API Contracts Are Too Loose

Several controllers accept `payload: any`, and service methods accept partial entity objects directly. This bypasses the global validation pipe and allows invalid or incomplete domain records to enter the database.

Impact:

- Missing `projectCode`, invalid `planCodes`, malformed `inputSchema`, and incomplete external-system records can pass too far into the service layer.
- API behavior will become hard to stabilize once external callers depend on it.
- Swagger output cannot serve as a reliable integration contract.

Recommendation:

- Add DTO classes for project, external system, capture plan, and capture run APIs.
- Validate required fields, code formats, URL fields, enabled flags, and JSON plan schema.
- Return stable error codes such as `PROJECT_NOT_FOUND`, `PLAN_NOT_FOUND`, `INPUT_VALIDATION_FAILED`, and `CAPTURE_FAILED`.
- Reject requested plan codes that do not exist instead of silently filtering them out.

### 3.3 Domain Model Does Not Yet Support Traceability

The requirements call for exact plan versions, parameter snapshots, selector metadata, source URL metadata, run steps, and masked secure values. The current entities only contain simplified JSON fields and basic run/asset records.

Missing or weak areas:

- No `capture_plan_versions` table.
- No `run_steps` table.
- No asset sequence table.
- Asset records lack plan ID, step ID, content type, source URL, selector snapshot, and parameter snapshot.
- Run records lack start time, finish time, error code, requested plans by code, and step diagnostics.

Recommendation:

- Introduce explicit plan versioning before capture execution becomes real.
- Add `run_steps` for step-level status, timings, messages, and diagnostics.
- Add `asset_sequences` for transactional asset code allocation by project/date/type.
- Extend assets to include trace fields required by audit and download/content APIs.

### 3.4 Persistence Strategy Is Still Prototype-Oriented

The current implementation uses TypeORM with `sql.js`, `autoSave`, and `synchronize: true`. This is acceptable for a local framework baseline, but it is weak for a capture engine that writes run state, step logs, asset metadata, and sequence numbers.

Impact:

- Schema changes are uncontrolled.
- Transactional asset code allocation is not yet modeled.
- Failure recovery around file writes and database writes is undefined.

Recommendation:

- Keep the current stack if the project favors NestJS, but turn off schema synchronization before real data accumulates.
- Add explicit migrations.
- Use transactions for run creation, status transitions, asset code allocation, and asset metadata writes.
- Define a local data directory contract for database, browser profiles, assets, logs, and secrets.

### 3.5 Security Defaults Need a Product Boundary

The project is local-first, but it still handles browser profiles, credentials, screenshots, structured data, and external API calls. Current defaults expose a seeded administrator and allow fallback JWT secret behavior.

Impact:

- If the API is bound outside localhost, weak default credentials and secrets become a real risk.
- Sensitive runtime parameters may be persisted in logs or snapshots before masking is implemented.

Recommendation:

- Refuse startup on non-local hosts unless API token and strong JWT secret are configured.
- Treat seeded admin credentials as first-run development only.
- Remove password prefill from production builds.
- Add secure parameter masking before run logs or API responses are returned.
- Keep browser profiles isolated per project and external system.

### 3.6 Frontend Surfaces Are Mostly Shells

The web console has a good navigation skeleton, theme handling, login guard, status button, and management layout. But several domain pages are placeholders, and the dashboard metrics are static.

Impact:

- The frontend cannot yet operate the core workflows from the requirements.
- Polishing the shell further would not increase MVP confidence.

Recommendation:

- Implement only the UI required to verify the next vertical slice:
  - project creation and selection
  - external system creation
  - JSON capture plan editing
  - manual run trigger
  - run detail and step timeline
  - asset list and download
- Delay visual DOM marking until the hand-written JSON execution path is stable.

### 3.7 Documentation Has a Framework Mismatch

The technical implementation plan still recommends Fastify, Drizzle, Zod, and React. The actual baseline uses NestJS, TypeORM/sql.js, class-validator, and Vue 3. The application-framework document explains this difference, but the technical implementation document should be updated so future contributors do not follow a parallel stack.

Recommendation:

- Keep the chosen NestJS/Vue framework if that is now the project direction.
- Rewrite the technical implementation plan around the actual stack.
- Preserve the core architecture decisions: Playwright worker, local SQLite-compatible persistence, local asset store, explicit JSON capture plans, and in-process queue for version 1.

## 4. Recommended Development Route

### Stage A: Contract and Model Hardening

Goal: make management data reliable enough for the capture engine.

Tasks:

- Add DTOs and validation for all create/update/run endpoints.
- Add detail/update/disable APIs for projects, systems, and plans.
- Add unique constraints for project code, system code within project, and plan code within project.
- Add normalized response and error shapes.
- Add capture plan schema types in `packages/shared`.

Exit criteria:

- Invalid payloads are rejected with stable 4xx responses.
- Project, system, and plan resources can be created and queried predictably.
- Type-check and build pass.

### Stage B: Minimal Capture Execution

Goal: prove the product value with a real browser and real assets.

Tasks:

- Add Playwright to the API package.
- Implement persistent browser profile paths under `data/browser-profiles/{projectCode}/{systemCode}`.
- Implement the minimal step executor.
- Implement selector candidate resolution.
- Implement page screenshot, element screenshot, and HTML table extraction.
- Write generated files under `data/assets/{projectCode}/{yyyyMMdd}/{runId}`.
- Store asset metadata with hashes and trace fields.
- Update run status from `pending` to `running`, then `succeeded` or `failed`.

Exit criteria:

- A hand-written capture plan can produce one image asset and one structured-data asset.
- The run record contains status, input snapshot, timings, and error information.
- Assets can be listed and downloaded through API.

### Stage C: Session Reuse

Goal: support the local manual-login workflow.

Tasks:

- Add interactive browser session APIs.
- Store browser profiles per project/system.
- Add login-check rules using URL patterns or selectors.
- Fail headless runs with `LOGIN_REQUIRED` when session validation fails.
- Add clear/refresh session controls.

Exit criteria:

- A user can log in manually once and reuse the session for later capture runs.
- Expired sessions fail with actionable diagnostics.

### Stage D: Operator UI for the Vertical Slice

Goal: expose the proven backend path through the console.

Tasks:

- Convert placeholder pages into focused CRUD and execution screens.
- Add JSON capture plan editor first.
- Add manual run form generated from input schema.
- Add run detail with step status and logs.
- Add asset preview/download actions.

Exit criteria:

- A local operator can configure and execute the minimal capture path without direct API calls.

### Stage E: DOM Marking and Operation Recording

Goal: make plan authoring more ergonomic after execution is proven.

Tasks:

- Add marking session APIs.
- Inject element picker script into controlled pages.
- Generate selector candidates.
- Save screenshot/data targets into plan drafts.
- Record simple operations and parameterize input values.

Exit criteria:

- User-selected DOM screenshot and table targets can produce executable plan JSON.

### Stage F: Diagnostics and Tests

Goal: make failures maintainable.

Tasks:

- Add `run_steps` persistence.
- Add step-level diagnostics and failure screenshots.
- Add retry policy support.
- Add a local fixture web app.
- Add unit tests for parameter merge, selector ordering, plan validation, and asset code allocation.
- Add integration tests for screenshot and table extraction.

Exit criteria:

- Failed runs identify the exact failing step.
- Integration tests prove the core capture chain.

## 5. Immediate Priority List

1. Align `docs/technical-implementation.md` with the actual NestJS/Vue baseline.
2. Add DTO validation for existing APIs.
3. Add plan version, run step, and richer asset entities.
4. Add Playwright worker and execute a hand-written plan from `POST /api/v1/capture-runs`.
5. Implement asset file writing and download APIs.
6. Add a fixture page and integration verification.
7. Build the minimum UI for JSON plan execution and asset review.

## 6. Verification Baseline

At the time of this review, the following checks passed:

```bash
pnpm.cmd type-check
pnpm.cmd build
```

The build reported non-blocking Vite warnings around large chunks and mixed static/dynamic imports for the auth store. Those warnings do not block the backend capture vertical slice, but they should be revisited when the frontend grows.

## 7. Review Positioning

This document should not replace the requirements or architecture documents. It is the implementation-facing audit line:

- Use `requirements.md` to understand what the product must do.
- Use `architecture.md` to understand the target module boundaries.
- Use `application-framework.md` to understand the current framework baseline.
- Use this document to understand the gap between the current code and the target product, and to decide the next development steps.
