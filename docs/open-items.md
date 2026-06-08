# Open Items

This document tracks the known gaps between the current MVP implementation and the broader product design.

## 1. Current Closure Status

The current implementation has a runnable MVP loop:

1. Create a project.
2. Add a business system.
3. Open and reuse a managed browser session.
4. Mark DOM targets and scan input parameters.
5. Copy generated plan JSON into a capture plan.
6. Trigger capture from the web console or external API.
7. Generate screenshot, JSON, and CSV assets with unique asset codes.
8. Inspect run steps, diagnostics, and asset downloads.

The loop is functionally closed, but plan authoring still has a manual copy step between DOM marking and capture plan editing.

## 2. Design Deviations and Scoped Gaps

### 2.1 Plan Draft Persistence

Current state:

- DOM marking returns copyable JSON snippets.
- Operators manually paste those snippets into the capture plan JSON editor.

Expected design:

- DOM marking results should be saved as editable plan drafts.
- Operators should be able to create or append a capture plan directly from marked elements.

Impact:

- The product is usable, but authoring is less smooth than the target workflow.

Priority: P0

### 2.2 Operation Recording

Current state:

- Marking records selected targets and scans visible input controls.
- It does not record a full sequence of user navigation operations.

Expected design:

- Marking mode should record user operations such as clicking menus, filling inputs, selecting options, and waiting for state changes.

Impact:

- Plans for complex pages still require hand-written steps.

Priority: P0

### 2.3 Selector Fallback During Execution

Current state:

- Selector candidates are generated and stored in marking output.
- Execution mainly uses the primary `selector` field.

Expected design:

- The worker should try selector candidates in priority order before failing.

Impact:

- Captures are more brittle when business pages change slightly.

Priority: P0

### 2.4 Capture Step Coverage

Current state:

- Supported steps: `goto`, `fill`, `selectOption`, `click`, `waitForSelector`, `screenshotPage`, `screenshotElement`, `extractTable`.

Expected design includes additional steps:

- `check`
- `press`
- `waitForUrl`
- `waitForNetworkIdle`
- `waitForResponse`
- `wait`
- `extractText`
- `extractJsonFromResponse`
- `assert`
- `manualCheckpoint`

Impact:

- The MVP covers common screenshot/table workflows, but complex web systems still need more step types.

Priority: P1

### 2.5 Capture Plan Versioning

Current state:

- Runs reference plan IDs and create run-step records.
- There is no immutable capture plan version snapshot.

Expected design:

- Each run should be traceable to the exact plan version and selector set used at execution time.

Impact:

- Auditability is acceptable for MVP but weaker than the target design.

Priority: P1

### 2.6 Secure Credential Store

Current state:

- Secure values are masked in run responses, diagnostics, and asset parameter snapshots.
- There is no encrypted credential store.

Expected design:

- Secure credentials should be stored outside capture plan JSON, preferably encrypted or referenced through a local secret store.

Impact:

- External callers can pass secure runtime parameters, but persistent credential management is not complete.

Priority: P1

### 2.7 Run Control

Current state:

- Runs execute synchronously.
- There is no cancel API, retry-run API, task queue, or worker pool.

Expected design:

- Support cancelling running tasks.
- Support retrying failed runs.
- Support queue-backed execution for longer captures.

Impact:

- Works for local single-user MVP, but long-running or concurrent workloads remain limited.

Priority: P1

### 2.8 Advanced Page Diagnostics

Current state:

- Failed steps record selector diagnostics and failure screenshots.
- Frame, shadow DOM, canvas, and virtualized component diagnostics are not specialized.

Expected design:

- Provide richer diagnostics for iframes, shadow DOM, canvas/SVG charts, virtualized grids, and network-driven data loading.

Impact:

- Diagnostics are useful for ordinary DOM failures but may be insufficient for complex enterprise UI frameworks.

Priority: P2

### 2.9 CI and Cross-Platform Verification

Current state:

- Local validation scripts exist.
- Smoke tests have been run on the current Windows environment.

Expected design:

- CI should run type-check/build and smoke coverage on Windows x64 and Linux ARM64 targets or representative runners.

Impact:

- The top-level platform constraint is reflected in code and docs, but continuous verification is not automated.

Priority: P2

## 3. Recommended Next Development Order

1. Persist DOM marking results as editable plan drafts.
2. Add selector-candidate fallback in the capture worker.
3. Record simple marking operations into plan steps.
4. Add high-value step types: `check`, `press`, `waitForUrl`, and `extractText`.
5. Add immutable capture plan versions for run traceability.
6. Add secure credential storage.
7. Add run cancel/retry APIs and queue-backed execution.
8. Add richer diagnostics for frames, shadow DOM, and canvas-heavy pages.
9. Add cross-platform CI verification.
