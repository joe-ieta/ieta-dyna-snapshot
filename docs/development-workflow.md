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
- Browser session reuse with persistent project/system profiles.
- DOM marking API and Business Systems page marking panel.
- Input parameter scanning for visible form controls.
- Step retry policy, selector diagnostics, and failure screenshots.
- API token support for external callers.
- Non-local startup safety checks.
- `pnpm --filter @ieta-dyna-snapshot/api smoke:capture` for real capture smoke verification.
- `pnpm --filter @ieta-dyna-snapshot/api smoke:security` for API token guard verification.

The next product-critical areas are:

- Plan-draft persistence from DOM marking results.
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

Implemented scope:

- Marking session API on business systems:
  - `GET /api/v1/external-systems/{id}/marking`
  - `POST /api/v1/external-systems/{id}/marking/start`
  - `POST /api/v1/external-systems/{id}/marking/stop`
  - `DELETE /api/v1/external-systems/{id}/marking/selections`
  - `POST /api/v1/external-systems/{id}/marking/scan-inputs`
- DOM picker script injected into the interactive Playwright browser session.
- Hover highlight and click-to-select behavior.
- Selector candidate generation from test IDs, IDs, names, aria labels, text, and CSS paths.
- Suggested plan JSON snippets for `screenshotElement`, `extractTable`, `click`, `fill`, and `selectOption`.
- Visible input detection from `input`, `textarea`, `select`, and `contenteditable`.
- Secure password fields are detected as secure parameters and do not expose value previews.
- Business Systems page DOM marking panel for starting/stopping marking, reading selections, scanning inputs, and copying JSON snippets.

Remaining work:

1. Persist marked elements as editable plan drafts instead of copy-only JSON snippets.
2. Record multi-step user operations beyond element click selection.
3. Add robust selector validation and alternate-selector retry.
4. Extend secure-value masking across all run logs and response surfaces.

## 6. Stage 6: Diagnostics, Security, and Tests

Goal: make the system maintainable for real business pages.

Implemented scope:

- Selector failure diagnostics record selector count, sample nodes, visibility state, text preview, and selector parse errors.
- Final step failures persist a `*-failure.png` diagnostic screenshot asset.
- Step-level retry policy:
  - `retry.attempts`
  - `retry.delayMs`
  - `retry.backoffMs`
  - legacy aliases `retryAttempts` and `retryDelayMs`
- Secure parameters are masked in asset parameter snapshots and failure diagnostics.
- `X-API-Token` and `X-Snapshot-API-Token` support for external callers.
- Non-local API startup is refused unless `JWT_SECRET` and API token settings are strong enough.
- Production web builds no longer prefill or display the default admin password.
- Swagger documents the API token scheme and trigger-run request example.
- `docs/external-api-guide.md` documents external invocation.
- Capture smoke now covers retry, failure screenshot, selector diagnostics, secure-value masking, screenshot capture, and table extraction.
- Security smoke covers missing token, invalid token, and valid API token access.

Remaining work:

1. Add richer diagnostics for frames and shadow DOM.
2. Add structured retry presets at plan level.
3. Add persistent audit logs for external API token usage.
4. Add CI wiring for smoke tests on both Windows x64 and Linux ARM64 hosts.

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

For security guard changes, also run:

```bash
pnpm --filter @ieta-dyna-snapshot/api smoke:security
```

Also verify:

- No generated `.js` files under `src/`.
- No `node_modules`, `.pnpm-store`, `dist`, `data`, or `logs` files staged for commit.
- API starts without missing `dist/main.js`.
- Web dev server opens at `http://127.0.0.1:4311`.
- API docs open at `http://127.0.0.1:4310/api/docs`.
- Security-sensitive values are masked in logs and responses.
