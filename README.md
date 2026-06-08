# ieta-dyna-snapshot

`ieta-dyna-snapshot` is a Node.js-based local web snapshot and structured data capture system. It reduces repeated manual work when collecting report materials from independent business web systems.

本项目实现一个基于 Node.js 的本地网页快照与结构化数据采集系统，用于把业务系统中的登录、条件选择、图表截图、表格抓取和资产归档流程沉淀为可重复执行的工程化采集任务。

## Top-Level Platform Constraint

The project must run on both:

- Windows x64 workstations.
- Linux ARM64 devices or servers.

Platform-sensitive implementation rules:

- Keep runtime code in Node.js/TypeScript and avoid Windows-only shell assumptions.
- Store paths through Node `path` APIs; persisted asset paths may be absolute on the local host, but generated relative paths must be platform-neutral.
- Browser automation uses Playwright Chromium. Install browser binaries with the npm script below on each target host.
- Linux ARM deployments may provide a system Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when the managed Playwright browser is not suitable.
- Do not add native dependencies unless they are known to support Windows and Linux ARM64 or have an explicit fallback.

## First-Version Scope

- Local single-machine deployment.
- Browser session reuse after manual login.
- Project-based capture plans.
- DOM-element screenshot targets.
- Structured data capture.
- Unique asset storage and metadata management.
- External HTTP APIs for triggering capture runs by project code.

Report generation and document insertion are outside the first-version scope.

## Documentation

Read the documents in this order:

1. [Requirements](docs/requirements.md)
2. [Architecture](docs/architecture.md)
3. [Technical Implementation](docs/technical-implementation.md)
4. [Application Framework Baseline](docs/application-framework.md)
5. [Project Review and Development Recommendations](docs/project-review-and-development-recommendations.md)
6. [Development Workflow](docs/development-workflow.md)

## Application Framework

- `apps/api`: NestJS management API with JWT authentication, permission decorators, TypeORM/sql.js persistence, seeded local administrator, capture execution, run trace APIs, asset APIs, and Swagger.
- `apps/web`: Vue 3 + Element Plus console with menu layout, login guard, project/system/plan/run/asset management pages, Pinia stores, and Axios API wrapper.
- `packages/shared`: shared TypeScript types for users, permissions, projects, plans, runs, steps, and assets.

Default local administrator:

```text
username: admin
password: admin123456
```

Local development:

```bash
pnpm install
pnpm browser:install
pnpm dev
```

Default endpoints:

- Web console: `http://127.0.0.1:4311`
- API service: `http://127.0.0.1:4310`
- Swagger: `http://127.0.0.1:4310/api/docs`

Capture smoke verification:

```bash
pnpm --filter @ieta-dyna-snapshot/api smoke:capture
```

Browser session reuse:

- Open a managed browser session from the Business Systems page.
- Log in manually in the launched browser.
- Configure `sessionPolicy.loginCheck` for systems that require login validation.
- Automatic runs reuse `data/browser-profiles/{projectCode}/{systemCode}`.

Linux ARM hosts can use a system Chromium when needed:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm dev
```
