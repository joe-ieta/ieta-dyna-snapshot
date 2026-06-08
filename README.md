# ieta-dyna-snapshot

`ieta-dyna-snapshot` is a planned Node.js-based local web snapshot and data capture system. It is intended to reduce repeated manual work when collecting report materials from independent business web systems.

本项目规划实现一个基于 Node.js 的本地网页快照与结构化数据采集系统，用于把业务系统中的登录、条件选择、图表截图、表格抓取和资产归档流程沉淀为可重复执行的工程化采集任务。

The first version focuses on:

- Local single-machine deployment.
- Browser session reuse after manual login.
- Project-based capture plans.
- DOM-element interactive screenshot marking.
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

## Recommended First Slice

The recommended implementation path is to first build a runnable capture core before polishing the recorder UI:

1. Define a project and capture plan.
2. Save or reuse a Playwright browser session.
3. Execute the plan through `POST /api/runs`.
4. Generate one DOM element screenshot and one structured data asset.
5. Query the run result and download the generated assets.

## Application Framework

The repository now contains a single local application skeleton inspired by the local `api-nova` management framework, but without reusing its OpenAPI/MCP business capabilities.

- `apps/api`: NestJS management API with JWT authentication, permission decorators, TypeORM/sql.js persistence, seeded local administrator, project/run/asset resource APIs, and Swagger.
- `apps/web`: Vue 3 + Element Plus console with a left navigation layout, top status bar, theme toggle, login guard, Pinia stores, and Axios API wrapper.
- `packages/shared`: shared TypeScript types for users, permissions, projects, runs, and assets.

Default local administrator:

```text
username: admin
password: admin123456
```

Local development:

```bash
pnpm install
pnpm dev
```

Default endpoints:

- Web console: `http://127.0.0.1:4311`
- API service: `http://127.0.0.1:4310`
- Swagger: `http://127.0.0.1:4310/api/docs`
