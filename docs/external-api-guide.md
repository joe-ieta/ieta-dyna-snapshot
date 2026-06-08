# External API Guide

This guide describes how an external scheduler, report system, or script can trigger capture jobs.

## Authentication

For non-interactive callers, configure an API token on the API host:

```bash
SNAPSHOT_API_TOKEN=change-this-to-a-long-random-token
```

Send it on every protected request:

```http
X-API-Token: change-this-to-a-long-random-token
```

JWT bearer tokens from the web login flow are still supported for interactive operators.

When `API_HOST` is not local, startup is refused unless both conditions are met:

- `JWT_SECRET` is explicitly set, is at least 32 characters, and is not `local-dev-secret`.
- `SNAPSHOT_API_TOKEN` or `SNAPSHOT_API_TOKENS` contains at least one token of 24 or more characters.

## Read Required Inputs

Before triggering a project, fetch its merged parameter contract:

```bash
curl -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  http://127.0.0.1:4310/api/v1/projects/REPORT_DEMO/inputs
```

The response includes project defaults, required parameters, and the plans that use them.

## Trigger Capture

```bash
curl -X POST http://127.0.0.1:4310/api/v1/capture-runs \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  -d '{
    "projectCode": "REPORT_DEMO",
    "planCodes": ["DASHBOARD_DAILY"],
    "parameters": {
      "reportDate": "2026-06-08",
      "regionCode": "EAST"
    },
    "source": "api"
  }'
```

Runtime parameters are merged with project defaults. Runtime values win.

## Inspect Results

```bash
curl -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  http://127.0.0.1:4310/api/v1/capture-runs/{runId}

curl -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  http://127.0.0.1:4310/api/v1/capture-runs/{runId}/steps

curl -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  "http://127.0.0.1:4310/api/v1/assets?runId={runId}"
```

Failed steps include selector diagnostics and may include a failure screenshot asset reference.

## Security Notes

- Do not expose the API outside localhost without setting `JWT_SECRET` and API tokens.
- Keep tokens out of capture plan JSON and runtime logs.
- Parameters marked `secure: true` or `type: "password"` are masked in asset parameter snapshots and failure diagnostics.
- Store generated assets only in trusted local directories.
