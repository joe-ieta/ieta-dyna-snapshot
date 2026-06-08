# Development Workflow

This document is the primary execution route for `ieta-dyna-snapshot`.

## 1. Current Position

The project now has:

- NestJS API with JWT login, permissions, TypeORM/sql.js persistence, and seeded local admin.
- Vue 3 + Element Plus console with menu layout, login guard, Pinia stores, theme toggle, and Axios wrapper.
- Project, business system, capture plan, capture run, run step, and asset APIs.
- Playwright capture worker for a hand-written JSON plan.
- PNG screenshot asset writing.
- JSON and CSV table asset writing.
- Asset download and structured content APIs.
- `pnpm --filter @ieta-dyna-snapshot/api smoke:capture` for real capture smoke verification.

The next product-critical areas are:

- DOM marking and selector generation UI.
- Security hardening for non-local exposure.
- More diagnostics and automated tests.

## 2. Top-Level Constraint

Every stage must preserve support for:

- Windows x64.
- Linux ARM64.

Do not introduce Windows-only shell dependencies, native packages without ARM64 support, or path handling that assumes one OS separator. Playwright Chromium installation is a host provisioning step and must remain scriptable through pnpm.

## 3. Stage 3: Minimal Operator UI

Goal: expose the working capture slice through the current console.

Implemented scope:

- Project CRUD.
- Business system CRUD.
- JSON capture plan editor.
- Manual run trigger form with project code, plan codes, and runtime parameters.
- Run detail drawer with input snapshot, timings, step list, and assets.
- Asset list, preview, and download.
- API-backed dashboard counters.

Acceptance criteria:

- A local operator can configure a JSON plan and run it from the UI.
- A local operator can inspect run steps.
- A local operator can preview/download generated assets.
- `pnpm.cmd type-check` passes.
- `pnpm.cmd build` passes.

## 4. Stage 4: Browser Session Reuse

Goal: support the intended local workflow: manual login once, then reuse the saved browser session.

Implemented scope:

- Browser profile path convention: `data/browser-profiles/{projectCode}/{systemCode}`.
- Interactive browser session open API.
- Persistent Playwright context for project/system profiles.
- Login-check rules:
  - URL regex
  - URL substring
  - selector exists
  - selector text
- Session status, refresh, and clear APIs.
- Business Systems page session controls.
- Headless/automatic runs fail with `LOGIN_REQUIRED` when configured session validation fails.
- Linux ARM escape hatch through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Session policy example:

```json
{
  "loginCheck": {
    "selector": ".user-avatar",
    "text": "",
    "timeoutMs": 5000
  }
}
```

## 5. Stage 5: DOM Marking and Parameterization

Goal: make plan authoring easier after the JSON execution path is stable.

Tasks:

1. Add marking session API.
2. Inject DOM element picker script.
3. Highlight hovered DOM elements.
4. Generate selector candidates.
5. Save selected screenshot/data targets into plan draft JSON.
6. Record simple operations.
7. Detect input labels/placeholders/names.
8. Convert recorded values into parameters.
9. Implement deterministic runtime parameter merge.
10. Mask secure values in logs and responses.

## 6. Stage 6: Diagnostics, Security, and Tests

Goal: make the system maintainable for real business pages.

Tasks:

1. Add selector failure diagnostics.
2. Add failure screenshots.
3. Add retry policy per step.
4. Add local fixture integration tests.
5. Add API token support for non-local exposure.
6. Refuse non-local host startup unless API token and strong JWT secret are configured.
7. Remove default password prefill from production builds.
8. Add external caller guide and Swagger examples.

## 7. Verification Checklist

Run before finishing any stage:

```bash
pnpm.cmd type-check
pnpm.cmd build
```

For capture worker changes, also run:

```bash
pnpm --filter @ieta-dyna-snapshot/api smoke:capture
```

Also verify:

- No generated `.js` files under `src/`.
- No `node_modules`, `.pnpm-store`, `dist`, `data`, or `logs` files staged for commit.
- API starts without missing `dist/main.js`.
- Web dev server opens at `http://127.0.0.1:4311`.
- API docs open at `http://127.0.0.1:4310/api/docs`.
- Security-sensitive values are masked in logs and responses.
