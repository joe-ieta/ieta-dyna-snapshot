const { existsSync } = require("fs");
const { mkdir, rm } = require("fs/promises");
const path = require("path");

const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "..", "..");
const distAppModule = path.join(apiRoot, "dist", "app.module.js");
const smokeDataRoot = path.join(repoRoot, "data", "smoke-security");
const apiToken = "security-smoke-token-1234567890";

if (!existsSync(distAppModule)) {
  console.error("API dist output is missing. Run pnpm.cmd --filter @ieta-dyna-snapshot/api build first.");
  process.exit(1);
}

process.env.SQLITE_PATH = path.join(smokeDataRoot, "app.db");
process.env.JWT_SECRET = "security-smoke-jwt-secret-1234567890";
process.env.SNAPSHOT_API_TOKEN = apiToken;

require("reflect-metadata");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");

async function requestJson(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, options);
  let body = undefined;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return { status: response.status, body };
}

async function main() {
  await rm(smokeDataRoot, { force: true, recursive: true });
  await mkdir(smokeDataRoot, { recursive: true });

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api");
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const noToken = await requestJson(baseUrl, "/api/v1/projects");
    const badToken = await requestJson(baseUrl, "/api/v1/projects", {
      headers: { "X-API-Token": "wrong-token" },
    });
    const goodToken = await requestJson(baseUrl, "/api/v1/projects", {
      headers: { "X-API-Token": apiToken },
    });

    const summary = {
      noTokenStatus: noToken.status,
      badTokenStatus: badToken.status,
      goodTokenStatus: goodToken.status,
      projectCount: Array.isArray(goodToken.body) ? goodToken.body.length : undefined,
    };
    console.log(JSON.stringify(summary, null, 2));

    if (noToken.status !== 401) throw new Error(`Expected 401 without token, got ${noToken.status}`);
    if (badToken.status !== 401) throw new Error(`Expected 401 with bad token, got ${badToken.status}`);
    if (goodToken.status !== 200) throw new Error(`Expected 200 with API token, got ${goodToken.status}`);
    if (!Array.isArray(goodToken.body)) throw new Error("Expected project list for API token request");
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
