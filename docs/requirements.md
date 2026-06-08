# Web Snapshot and Data Capture System Requirements

## 1. Background

Business reporting often requires operators to open multiple independent web systems, sign in, select query conditions, inspect dashboards or tables, and then save screenshots or copy structured data into downstream report materials. The same steps are repeated for every report cycle and are hard to trace once screenshots and copied data leave the source system.

This system provides a local, Node.js-based web snapshot and data capture platform. It turns repeated manual browser operations into reusable capture projects, parameterized capture plans, managed assets, and externally callable execution services.

## 2. Product Scope

The first version is a single-machine system. It runs locally, controls a local browser, persists browser sessions where allowed, stores captured assets on the local file system, and exposes HTTP APIs so external systems can trigger capture runs.

The first version treats screenshots and structured data capture as equally important. It does not implement downstream report generation, document insertion, or report template rendering. The output boundary is the asset library.

## 3. Goals

- Create and manage capture projects.
- Open target business systems inside a controlled browser session.
- Allow users to sign in manually and persist reusable browser sessions.
- Record reusable page paths and capture plans under each project.
- Identify user input points and convert them into project parameters.
- Let users interactively choose screenshot regions by DOM element.
- Capture page screenshots, element screenshots, and structured table/data outputs.
- Assign globally unique asset codes within each project.
- Store assets, metadata, execution inputs, and run history.
- Expose external APIs for listing required inputs and triggering capture runs.

## 4. Non-Goals for Version 1

- Multi-user SaaS deployment.
- Fine-grained enterprise permission management.
- Report generation, Word insertion, ONLYOFFICE integration, or template replacement.
- Full automation of CAPTCHA, SMS code, MFA, or hardware token authentication.
- Guaranteed extraction from every canvas, virtualized, encrypted, or heavily obfuscated web component.
- Browser extension marketplace packaging.

## 5. Key Concepts

### 5.1 Project

A project groups capture plans, target systems, parameter definitions, browser sessions, run records, and generated assets. A project normally maps to a report scenario or recurring material collection task, such as monthly operations analysis.

### 5.2 External System

An external system is a target business web system under a project. It includes base URL, login URL, browser profile binding, session policy, and optional login validation rules.

### 5.3 Capture Plan

A capture plan is a reusable workflow that opens one or more pages, fills or selects conditions, waits for data to load, and captures screenshots or structured data.

### 5.4 Project Parameter

A project parameter is a user-provided value needed before a run. It can come from manual input, external API payload, default project configuration, or secure credential storage.

### 5.5 Asset

An asset is a managed output created by a capture run. It can be an image, CSV, JSON, XLSX, HTML snapshot, or metadata-only reference.

## 6. User Roles

Version 1 can use a simplified local role model:

- Operator: creates projects, records capture paths, marks regions, triggers runs, reviews assets.
- External caller: calls HTTP APIs to query project inputs and trigger capture runs.
- Administrator: manages local storage, encryption keys, and system settings.

These roles can be implemented as local capability boundaries rather than full login accounts in the first version.

## 7. Main Workflows

### 7.1 Project Setup Workflow

1. Operator creates a project and assigns a project code.
2. Operator adds one or more external systems.
3. Operator opens an external system in the managed browser.
4. Operator signs in manually if no valid session exists.
5. System stores the browser context after successful login.
6. Operator creates or records capture plans under the project.

### 7.2 Capture Marking Workflow

1. Operator opens a target page in marking mode.
2. Operator performs required page operations, such as clicking menus, entering query conditions, and selecting dropdown values.
3. System records page operations as candidate steps.
4. System detects input elements and lets the operator map them to project parameters.
5. Operator selects screenshot regions by interacting with DOM elements.
6. Operator marks structured data targets, such as tables, repeated rows, or API responses.
7. System saves the capture plan with editable steps and validation rules.

### 7.3 Manual Run Workflow

1. Operator selects a project and capture plan.
2. System displays required parameters.
3. Operator fills or confirms parameter values.
4. System launches the browser with the bound session.
5. System executes the capture plan.
6. System stores generated assets with unique asset codes.
7. Operator reviews the run result and asset list.

### 7.4 External API Run Workflow

1. External caller requests the project parameter schema.
2. External caller submits a capture run request with project code, optional capture plan list, and runtime parameter values.
3. System merges runtime values with project defaults and saved marking-time parameter mappings.
4. System validates required inputs.
5. System executes the selected capture plans.
6. System returns run ID, status, and generated asset metadata.
7. External caller can poll run status or fetch asset metadata by run ID.

## 8. Functional Requirements

### 8.1 Project Management

- Create, update, disable, and list projects.
- Project code must be unique.
- Project must have a stable asset root path.
- Project can define default parameters shared by all capture plans.
- Project can define asset code prefix and numbering rules.

### 8.2 External System Management

- Add, update, disable, and list external systems under a project.
- Store base URL, login URL, and optional health-check URL.
- Bind each external system to an isolated browser profile.
- Support manual login and session persistence.
- Support login status checks through URL patterns, selectors, or custom scripts.
- Detect session expiration and mark the run as requiring manual login.

### 8.3 Browser Session Management

- Persist cookies, localStorage, sessionStorage where technically possible.
- Keep browser profiles isolated per project and external system.
- Allow clearing a saved session.
- Allow manually refreshing a session.
- Encrypt sensitive profile metadata where possible.

### 8.4 Capture Plan Authoring

- Create capture plans under a project.
- Store steps as structured JSON.
- Support both recorded and manually edited steps.
- Allow steps to reference project parameters.
- Allow plan-level parameters in addition to project-level parameters.
- Provide validation before saving a plan.

### 8.5 Supported Capture Steps

Required step types:

- `goto`: open URL.
- `click`: click element.
- `fill`: fill input element.
- `select`: select dropdown option.
- `check`: check or uncheck checkbox/radio.
- `press`: send keyboard input.
- `waitForSelector`: wait for DOM element.
- `waitForUrl`: wait for URL change.
- `waitForNetworkIdle`: wait for network idle.
- `waitForResponse`: wait for specific response pattern.
- `wait`: fixed delay, only as fallback.
- `screenshotPage`: capture full page or viewport.
- `screenshotElement`: capture DOM element region.
- `extractTable`: extract tabular data.
- `extractText`: extract text from selected DOM element.
- `extractJsonFromResponse`: capture structured response data.
- `assert`: validate that expected page state exists.
- `manualCheckpoint`: pause for manual intervention.

### 8.6 Interactive DOM Element Selection

- In marking mode, user can hover and select page elements.
- System highlights candidate DOM elements.
- User can choose current element, parent element, or child element.
- System stores selector candidates for the chosen element.
- System stores a preview image for the marked region.
- System supports naming the region, such as `sales_chart`, `inventory_table`, or `kpi_summary`.

### 8.7 Selector Strategy

The system should store multiple selector candidates for important elements:

- CSS selector.
- XPath.
- ARIA role and accessible name where available.
- Text selector where stable.
- Data attributes such as `data-testid`.
- Relative selector from a stable parent.

Execution should try selectors in priority order and fail with clear diagnostics if none match.

### 8.8 Input Parameter Management

- Detect input points during marking, including text inputs, password inputs, date pickers, selects, radio buttons, checkboxes, and custom controls where possible.
- Convert input points into named parameters.
- Store parameter metadata:
  - name
  - label
  - type
  - required flag
  - default value
  - secure flag
  - allowed values
  - validation rule
  - mapped selectors
- Merge parameter values in the following priority:
  1. External API runtime values.
  2. Manual run values.
  3. Capture plan defaults.
  4. Project defaults.
  5. Secure credential store values.

### 8.9 Screenshot Capture

- Capture full page screenshots.
- Capture viewport screenshots.
- Capture selected DOM element screenshots.
- Support user-selected DOM regions from marking mode.
- Support fixed viewport and device scale factor configuration.
- Support image format PNG and JPEG.
- Store screenshot metadata, including URL, selector, viewport, and parameter snapshot.

### 8.10 Structured Data Capture

- Extract simple HTML tables.
- Extract repeated DOM row/card structures using configured selectors.
- Extract selected text blocks.
- Capture JSON payloads from matched network responses.
- Export captured data as JSON and CSV in version 1.
- Store schema metadata when table headers can be detected.
- Preserve raw extraction output for audit.

### 8.11 Asset Management

- Generate unique asset codes under each project.
- Store files under project asset root by run date and run ID.
- Store asset metadata in the database.
- Support asset types:
  - `image`
  - `table`
  - `json`
  - `text`
  - `html`
  - `log`
- Support listing assets by project, run, plan, type, and creation time.
- Support reading asset metadata through API.
- Support downloading asset files through API.

### 8.12 External APIs

The system must expose HTTP APIs for external orchestration.

Minimum required API capabilities:

- Query projects.
- Query project parameter schema.
- Query capture plans and required inputs.
- Trigger a capture run by project code.
- Pass runtime parameter values.
- Select one or more capture plans to run.
- Poll run status.
- List generated assets for a run.
- Download asset files or read structured asset content.

### 8.13 Run Management

- Each run must have a unique run ID.
- Run status values:
  - `pending`
  - `running`
  - `waiting_for_manual_action`
  - `succeeded`
  - `failed`
  - `cancelled`
- Store start time, end time, inputs snapshot, step logs, and errors.
- Allow retrying a failed run.
- Allow cancelling a running run where technically possible.

### 8.14 Audit and Traceability

- Store the exact capture plan version used by a run.
- Store the exact parameter snapshot used by a run.
- Store source URL and selector metadata for each asset.
- Store step-level execution logs.
- Mask secure values in logs.

### 8.15 Security Requirements

- Do not log plaintext passwords.
- Mark sensitive parameters as secure.
- Encrypt stored credentials or avoid storing them unless explicitly configured.
- Keep browser profiles isolated by project and external system.
- Require an API token for external calls in version 1 if the service is reachable outside localhost.
- Provide configuration to bind only to `127.0.0.1` by default.

## 9. External API Request Example

```json
{
  "projectCode": "RPT-OPS-202606",
  "planCodes": ["sales-dashboard", "inventory-table"],
  "parameters": {
    "report_date": "2026-06-08",
    "org_code": "HQ",
    "metric_type": "monthly"
  },
  "options": {
    "headless": true,
    "assetCodePrefix": "OPS202606"
  }
}
```

The runtime parameters above are merged with project defaults and the parameters defined during marking. The merged result is then used to fill page controls and execute screenshots or data extraction.

## 10. Acceptance Criteria for Version 1

- A local user can create a project.
- A local user can add a web system and save a browser session after manual login.
- A local user can mark at least one DOM element as a screenshot target.
- A local user can mark at least one table or response as a structured data target.
- A capture plan can be executed repeatedly with different parameter values.
- External API can trigger a capture run by project code.
- Generated screenshot and structured data assets receive unique asset codes.
- Generated assets and metadata are queryable through API.
- Run history records inputs, status, step logs, and generated assets.
