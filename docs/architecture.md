# Web Snapshot and Data Capture System Architecture

## 1. Architecture Overview

The system is a local Node.js service that manages capture projects, controls Chromium through Playwright, stores browser sessions, captures screenshots and structured data, and exposes HTTP APIs for external execution.

Version 1 is designed as a single-machine application with a local web console and a local service API. The architecture keeps the capture engine independent from the UI so future integrations can drive captures without using the web console.

```text
Local Web Console
  - project setup
  - browser marking
  - parameter input
  - run monitor
  - asset browser

External Caller
  - query project inputs
  - trigger capture runs
  - query run status
  - fetch assets

Node.js API Server
  - Project Service
  - External System Service
  - Capture Plan Service
  - Parameter Service
  - Run Service
  - Asset Service
  - Credential Service

Capture Worker
  - Playwright browser control
  - browser context/session reuse
  - step executor
  - DOM element selector resolver
  - screenshot capture
  - structured data extraction
  - network response capture

Storage
  - SQLite metadata database
  - local asset file store
  - browser profile store
  - encrypted secrets store
```

## 2. Deployment Shape

Version 1 runs as one local Node.js process with optional worker child processes.

```text
node server
  - HTTP API
  - static Web UI
  - task queue
  - Playwright worker pool
```

Default service binding should be `127.0.0.1`. If exposed on LAN, API token authentication must be enabled.

## 3. Module Boundaries

### 3.1 Web Console

The Web Console is responsible for human workflows:

- Create and edit projects.
- Add external systems.
- Open target system pages in marking mode.
- Display browser session status.
- Highlight DOM elements for selection.
- Define screenshot and data capture targets.
- Edit capture plans and parameters.
- Start manual runs.
- Review assets and execution logs.

The Web Console should not directly manipulate browser automation internals. It calls API endpoints and receives browser state, selector candidates, previews, and run events from the backend.

### 3.2 API Server

The API Server is the stable integration boundary. It serves both the Web Console and external callers.

Primary responsibilities:

- Validate project and plan references.
- Merge runtime parameters with project and plan defaults.
- Start capture runs.
- Report run status.
- Serve asset metadata and files.
- Enforce local security policy.

### 3.3 Project Service

The Project Service manages:

- Project code uniqueness.
- Project metadata.
- Project-level parameter defaults.
- Asset root path.
- Asset numbering rules.

### 3.4 External System Service

The External System Service manages target business systems:

- Base URL and login URL.
- Browser profile binding.
- Session validity rules.
- Login refresh state.
- System-level timeout and viewport defaults.

### 3.5 Capture Plan Service

The Capture Plan Service stores reusable workflows:

- Capture plan metadata.
- Step definitions.
- Marked DOM targets.
- Input parameter schema.
- Capture plan versions.

Capture plans are versioned because a run must be traceable to the exact steps and selectors used at execution time.

### 3.6 Parameter Service

The Parameter Service owns input schema and value merging.

Merge priority:

1. External API runtime values.
2. Web Console manual run values.
3. Capture plan defaults.
4. Project defaults.
5. Secure credential values.

The service must mask secure values before logs, run summaries, or API responses are returned.

### 3.7 Capture Worker

The Capture Worker executes capture plans using Playwright.

Responsibilities:

- Load browser profile.
- Open target pages.
- Execute steps.
- Resolve selector candidates.
- Wait for page readiness.
- Capture screenshots.
- Extract structured data.
- Save raw outputs.
- Report step-level logs.
- Emit run progress events.

The worker should be replaceable or horizontally separable in later versions.

### 3.8 Asset Service

The Asset Service assigns unique asset codes, writes files, calculates hashes, stores metadata, and serves assets through API.

Assets are immutable by default. If a capture is re-run, new assets are created and linked to the new run.

### 3.9 Credential Service

The Credential Service manages sensitive values:

- Password-like project parameters.
- API tokens.
- Optional encryption keys.
- References to saved browser profiles.

Sensitive values must not be stored in capture plan JSON as plaintext.

## 4. Runtime Data Flow

### 4.1 Marking Flow

```text
User
  -> Web Console
  -> API Server: create or open marking session
  -> Capture Worker: launch persistent browser context
  -> User performs page operations
  -> Injected page script collects DOM operation candidates
  -> User selects screenshot/data targets
  -> API Server stores selectors, parameters, and plan steps
```

Marking mode should distinguish between operation recording and target marking. Operation recording records how to reach the target page. Target marking records what to capture once the page is ready.

### 4.2 External Execution Flow

```text
External Caller
  -> POST /api/runs
  -> API Server validates projectCode and planCodes
  -> Parameter Service merges inputs
  -> Run Service creates run record
  -> Capture Worker executes selected plans
  -> Asset Service writes outputs and metadata
  -> API Server returns run status and asset references
```

### 4.3 Session Reuse Flow

```text
Run starts
  -> load project external system profile
  -> open login validation page or target URL
  -> evaluate login status rule
  -> if valid: continue execution
  -> if invalid and headless=false: pause for manual login
  -> if invalid and headless=true: fail with LOGIN_REQUIRED
  -> after manual login: persist browser context
```

## 5. Core Domain Model

### 5.1 Project

```text
Project
  id
  code
  name
  description
  assetRoot
  assetCodeRule
  defaultParameters
  createdAt
  updatedAt
```

### 5.2 ExternalSystem

```text
ExternalSystem
  id
  projectId
  code
  name
  baseUrl
  loginUrl
  browserProfileId
  sessionPolicy
  loginCheckRule
  defaultViewport
  createdAt
  updatedAt
```

### 5.3 CapturePlan

```text
CapturePlan
  id
  projectId
  externalSystemId
  code
  name
  description
  currentVersionId
  enabled
  createdAt
  updatedAt
```

### 5.4 CapturePlanVersion

```text
CapturePlanVersion
  id
  capturePlanId
  version
  steps
  inputSchema
  targetDefinitions
  createdAt
```

### 5.5 CaptureStep

```text
CaptureStep
  id
  type
  name
  selectorCandidates
  valueRef
  valueLiteral
  timeoutMs
  retryPolicy
  waitPolicy
  outputRef
  metadata
```

### 5.6 SelectorCandidate

```text
SelectorCandidate
  type: css | xpath | role | text | testId | relative
  value
  priority
  stabilityScore
  source
```

### 5.7 InputParameter

```text
InputParameter
  name
  label
  type
  required
  secure
  defaultValue
  allowedValues
  validationRule
  mappedSteps
  description
```

### 5.8 CaptureRun

```text
CaptureRun
  id
  projectId
  status
  requestedPlanIds
  inputSnapshot
  requestedBy
  source
  startedAt
  finishedAt
  errorCode
  errorMessage
```

### 5.9 Asset

```text
Asset
  id
  assetCode
  projectId
  runId
  planId
  stepId
  type
  title
  filePath
  contentType
  contentHash
  sourceUrl
  selectorSnapshot
  parameterSnapshot
  metadata
  createdAt
```

## 6. Asset Storage Layout

Recommended local layout:

```text
workspace/
  data/
    app.db
    secrets/
    browser-profiles/
      {projectCode}/
        {systemCode}/
    assets/
      {projectCode}/
        {yyyyMMdd}/
          {runId}/
            images/
            tables/
            json/
            logs/
```

Asset metadata must live in the database. The file path stores the physical output only.

## 7. Asset Code Strategy

Recommended default:

```text
{projectCode}-{assetType}-{yyyyMMdd}-{sequence}
```

Example:

```text
OPS202606-IMG-20260608-0001
OPS202606-TABLE-20260608-0002
```

The sequence should be allocated transactionally by project and date to avoid duplicate asset codes during concurrent or retried runs.

## 8. API Architecture

### 8.1 Project and Schema APIs

```text
GET  /api/projects
GET  /api/projects/{projectCode}
GET  /api/projects/{projectCode}/inputs
GET  /api/projects/{projectCode}/plans
GET  /api/projects/{projectCode}/plans/{planCode}/inputs
```

### 8.2 Run APIs

```text
POST /api/runs
GET  /api/runs/{runId}
POST /api/runs/{runId}/cancel
POST /api/runs/{runId}/retry
GET  /api/runs/{runId}/assets
```

### 8.3 Asset APIs

```text
GET  /api/assets
GET  /api/assets/{assetCode}
GET  /api/assets/{assetCode}/download
GET  /api/assets/{assetCode}/content
```

### 8.4 Marking APIs

```text
POST /api/marking-sessions
GET  /api/marking-sessions/{sessionId}
POST /api/marking-sessions/{sessionId}/targets
POST /api/marking-sessions/{sessionId}/steps
POST /api/marking-sessions/{sessionId}/save-plan
```

Marking APIs are primarily for the Web Console, not external integrations.

## 9. Capture Reliability Design

### 9.1 Readiness Policy

Every capture target should define how the page is considered ready:

- Element exists.
- Element is visible.
- Network response completed.
- DOM text matches expectation.
- Row count is greater than zero.
- Chart canvas or SVG has non-empty dimensions.
- Fixed delay as fallback.

### 9.2 Selector Fallback

For each important element, the worker should:

1. Try selector candidates in priority order.
2. Confirm the element is visible and stable.
3. Optionally compare text or bounding box hints.
4. Fail with selector diagnostics if no candidate is valid.

### 9.3 Manual Checkpoint

Manual checkpoint supports cases such as CAPTCHA, MFA, expired login, or complex interactive controls. In headless external API mode, manual checkpoints should fail with a clear status unless the caller explicitly allows an interactive run.

## 10. Security Architecture

- Bind HTTP service to localhost by default.
- Require API token if network exposure is enabled.
- Store secure parameters outside capture plan JSON.
- Mask secure values in logs and API responses.
- Keep browser profiles per project and system.
- Avoid uploading captured data to external services in version 1.

## 11. Extension Points

The architecture leaves room for:

- Multi-user deployment.
- Remote worker nodes.
- Scheduling service.
- Object storage.
- Report-generation integrations.
- Browser extension assisted marking.
- OCR-based extraction from screenshots.
- AI-assisted selector repair.
