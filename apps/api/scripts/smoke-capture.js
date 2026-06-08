const { existsSync } = require("fs");
const { mkdir, readFile, rm } = require("fs/promises");
const http = require("http");
const path = require("path");

const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "..", "..");
const distAppModule = path.join(apiRoot, "dist", "app.module.js");
const smokeDataRoot = path.join(repoRoot, "data", "smoke-capture");

if (!existsSync(distAppModule)) {
  console.error("API dist output is missing. Run pnpm.cmd --filter @ieta-dyna-snapshot/api build first.");
  process.exit(1);
}

process.env.SQLITE_PATH = path.join(smokeDataRoot, "app.db");
process.env.SNAPSHOT_BROWSER_PROFILE_ROOT = path.join(smokeDataRoot, "browser-profiles");

require("reflect-metadata");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { SnapshotService } = require("../dist/modules/projects/snapshot.service");

function createFixtureServer() {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Snapshot Fixture</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      #capture { width: 520px; border: 1px solid #b8c4d4; padding: 16px; }
      table { border-collapse: collapse; width: 100%; margin-top: 12px; }
      th, td { border: 1px solid #d5dce7; padding: 6px 8px; text-align: left; }
    </style>
    <script>
      setTimeout(() => {
        const marker = document.createElement("div");
        marker.id = "late-marker";
        marker.textContent = "Ready";
        document.body.appendChild(marker);
      }, 250);
    </script>
  </head>
  <body>
    <section id="capture">
      <h1>Smoke Capture Fixture</h1>
      <label>Keyword <input id="keyword" /></label>
      <table id="metrics">
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Alpha</td><td>10</td></tr>
        <tr><td>Beta</td><td>20</td></tr>
      </table>
    </section>
  </body>
</html>`;

  return http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function main() {
  await rm(smokeDataRoot, { force: true, recursive: true });
  await mkdir(smokeDataRoot, { recursive: true });

  const server = createFixtureServer();
  const port = await listen(server);
  const fixtureBaseUrl = `http://127.0.0.1:${port}/`;
  const projectCode = `SMOKE${Date.now()}`;

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const service = app.get(SnapshotService);
    const project = await service.createProject({
      code: projectCode,
      name: "Smoke Capture Project",
      assetRoot: path.join(smokeDataRoot, "assets", projectCode),
    });
    const system = await service.createSystem({
      projectId: project.id,
      code: "FIXTURE",
      name: "Local Fixture",
      baseUrl: fixtureBaseUrl,
      sessionPolicy: { loginCheck: { selector: "#capture", timeoutMs: 5000 } },
    });
    const lockedSystem = await service.createSystem({
      projectId: project.id,
      code: "LOCKED",
      name: "Locked Fixture",
      baseUrl: fixtureBaseUrl,
      sessionPolicy: { loginCheck: { selector: "#missing-login-marker", timeoutMs: 300 } },
    });
    await service.createPlan({
      projectId: project.id,
      externalSystemId: system.id,
      code: "BASIC",
      name: "Basic Capture",
      steps: [
        { id: "open", type: "goto", name: "Open fixture" },
        {
          id: "wait-late-marker",
          type: "waitForSelector",
          name: "Wait for delayed marker",
          selector: "#late-marker",
          timeoutMs: 100,
          retry: { attempts: 5, delayMs: 100 },
        },
        { id: "fill-keyword", type: "fill", name: "Fill keyword", selector: "#keyword", value: "{{keyword}}" },
        { id: "shot-card", type: "screenshotElement", name: "Capture card", selector: "#capture" },
        { id: "table-metrics", type: "extractTable", name: "Extract metrics", selector: "#metrics" },
      ],
      inputSchema: [{ name: "keyword", label: "Keyword", type: "string", required: true, secure: false }],
    });
    await service.createPlan({
      projectId: project.id,
      externalSystemId: system.id,
      code: "FAIL_SELECTOR",
      name: "Failure Diagnostics",
      steps: [
        {
          id: "missing-card",
          type: "screenshotElement",
          name: "Missing card",
          selector: "#missing-card",
          timeoutMs: 150,
          retry: { attempts: 1, delayMs: 50 },
        },
      ],
      inputSchema: [{ name: "secretToken", label: "Secret token", type: "password", required: false, secure: true }],
    });
    await service.createPlan({
      projectId: project.id,
      externalSystemId: lockedSystem.id,
      code: "LOCKED_BASIC",
      name: "Locked Capture",
      steps: [
        { id: "open-locked", type: "goto", name: "Open locked fixture" },
      ],
      inputSchema: [],
    });

    const run = await service.triggerRun({
      projectCode,
      planCodes: ["BASIC"],
      parameters: { keyword: "Beta" },
      source: "api",
    });
    const steps = await service.listRunSteps(run.id);
    const assets = await service.listAssets(run.id);
    const jsonAsset = assets.find((asset) => asset.contentType === "application/json");
    const tableJson = jsonAsset ? JSON.parse(await readFile(jsonAsset.filePath, "utf8")) : undefined;

    const summary = {
      runId: run.id,
      status: run.status,
      steps: steps.map((step) => ({ stepId: step.stepId, status: step.status })),
      assets: assets.map((asset) => ({
        assetCode: asset.assetCode,
        type: asset.type,
        contentType: asset.contentType,
        filePath: asset.filePath,
      })),
      tableRows: tableJson?.rows?.length || 0,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (run.status !== "succeeded") throw new Error(`Expected succeeded run, got ${run.status}`);
    if (steps.some((step) => step.status !== "succeeded")) throw new Error("Not all run steps succeeded");
    if (!assets.some((asset) => asset.contentType === "image/png")) throw new Error("Missing image asset");
    if (!assets.some((asset) => asset.contentType === "application/json")) throw new Error("Missing JSON asset");
    if (!assets.some((asset) => asset.contentType === "text/csv")) throw new Error("Missing CSV asset");
    if (summary.tableRows !== 2) throw new Error("Unexpected table extraction row count");
    const retryStep = steps.find((step) => step.stepId === "wait-late-marker");
    if (!retryStep?.diagnostics || Number(retryStep.diagnostics.attempts || 0) < 2) {
      throw new Error("Retry diagnostics were not recorded");
    }

    const failedSelectorRun = await service.triggerRun({
      projectCode,
      planCodes: ["FAIL_SELECTOR"],
      parameters: { secretToken: "super-secret-value" },
      source: "api",
    });
    const failedSelectorSteps = await service.listRunSteps(failedSelectorRun.id);
    const failedSelectorAssets = await service.listAssets(failedSelectorRun.id);
    const failedStep = failedSelectorSteps.find((step) => step.stepId === "missing-card");
    if (failedSelectorRun.status !== "failed") {
      throw new Error(`Expected failed selector run, got ${failedSelectorRun.status}`);
    }
    if (!failedStep?.diagnostics?.selectorDiagnostics) {
      throw new Error("Missing selector diagnostics for failed step");
    }
    if (!failedStep.diagnostics.failureScreenshot) {
      throw new Error("Missing failure screenshot diagnostic");
    }
    if (!failedSelectorAssets.some((asset) => asset.metadata?.diagnostic === true && asset.contentType === "image/png")) {
      throw new Error("Missing persisted failure screenshot asset");
    }
    if (JSON.stringify(failedStep).includes("super-secret-value")) {
      throw new Error("Secure parameter leaked into failure diagnostics");
    }

    const lockedRun = await service.triggerRun({
      projectCode,
      planCodes: ["LOCKED_BASIC"],
      parameters: {},
      source: "api",
    });
    if (lockedRun.status !== "failed") throw new Error(`Expected failed locked run, got ${lockedRun.status}`);
    if (lockedRun.errorCode !== "LOGIN_REQUIRED") {
      throw new Error(`Expected LOGIN_REQUIRED, got ${lockedRun.errorCode}: ${lockedRun.errorMessage}`);
    }
  } finally {
    await app.close();
    await close(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
