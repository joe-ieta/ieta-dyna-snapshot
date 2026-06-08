# Application Framework Baseline

This project borrows the application-frame ideas from the local `E:\CodexDev\api-nova` project while keeping business capabilities independent.

## Borrowed Framework Ideas

- Monorepo workspace with separated frontend, backend, and shared type packages.
- Vue 3 management console with Element Plus.
- Left-side navigation generated from route metadata.
- Top header with system health, refresh, theme toggle, and user menu.
- Pinia stores for authentication, theme, and application state.
- Axios service wrapper with bearer token injection and centralized error handling.
- NestJS backend with modular controllers and services.
- JWT authentication with guarded routes.
- Permission decorator and permission guard pattern.
- TypeORM persistence using a local SQLite-compatible sql.js store.
- Seeded local administrator for first-run development.

## Deliberately Not Borrowed

- OpenAPI parsing.
- MCP tool generation.
- API gateway runtime.
- API publication workflow.
- Existing ApiNova business pages, entities, or services.

## Snapshot Application Surfaces

The menu surfaces are adapted for the snapshot capture product:

- Dashboard: overview of project/run/asset status.
- Projects: capture project management.
- Business Systems: target web system and browser session management.
- Capture Plans: page path, parameter, DOM region, and data extraction rules.
- Runs: manual or external API driven capture execution.
- Assets: screenshot and structured data asset library.
- Auth: local user and permission boundary.
- Config: local service and storage configuration.
- Monitoring: service health and future worker metrics.

## Current Implementation Boundary

The current code is the foundation application shell plus basic management APIs. It does not yet include the Playwright capture worker, DOM marking script, browser profile persistence, or real asset file generation. Those should be implemented as the next vertical slice on top of this framework.
