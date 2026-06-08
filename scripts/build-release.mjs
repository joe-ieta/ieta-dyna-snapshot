#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const defaultReleaseRoot = resolve(repoRoot, "..", "ieta-dyna-snapshot-release");

const args = parseArgs(process.argv.slice(2));
const releaseRoot = resolve(args.releaseDir || defaultReleaseRoot);
const portableOnly = args.portableOnly;
const copyNodeModules = !portableOnly && args.copyNodeModules;
const copyNodeRuntime = !portableOnly && args.copyNodeRuntime;
const copyBrowserCache = !portableOnly && args.copyBrowserCache;

await ensureSafeReleaseRoot(releaseRoot);

if (!args.skipBuild) {
  run("pnpm", ["type-check"], repoRoot);
  run("pnpm", ["build"], repoRoot);
}

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });

await copyProjectArtifacts();
await writeRuntimeFiles();
await writeDocumentation();
await writeManifest();

const warnings = [];
if (copyNodeModules) {
  await copyOptional(join(repoRoot, "node_modules"), join(releaseRoot, "node_modules"), warnings, "node_modules");
}
if (copyNodeRuntime) {
  const nodeRoot = detectNodeRuntimeRoot();
  if (nodeRoot) {
    const platformDir = process.platform === "win32" ? "windows-x64" : process.arch === "arm64" ? "linux-arm64" : `${process.platform}-${process.arch}`;
    await copyOptional(nodeRoot, join(releaseRoot, "runtime", "node", platformDir), warnings, `Node runtime ${nodeRoot}`);
  } else {
    warnings.push("未能识别可复制的 Node 运行时目录；启动脚本将回退到系统 PATH 中的 node。");
  }
}
if (copyBrowserCache) {
  const browserCache = detectPlaywrightCacheRoot();
  if (browserCache) {
    await copyOptional(browserCache, join(releaseRoot, "runtime", "ms-playwright"), warnings, `Playwright browser cache ${browserCache}`);
  } else {
    warnings.push("未找到 Playwright 浏览器缓存；目标环境需执行 install-runtime 脚本或配置 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH。");
  }
}

console.log(`发布目录已生成: ${releaseRoot}`);
console.log(`启动入口: ${join(releaseRoot, process.platform === "win32" ? "start.cmd" : "start.sh")}`);
if (warnings.length > 0) {
  console.log("\n注意:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

function parseArgs(argv) {
  const result = {
    releaseDir: undefined,
    skipBuild: false,
    portableOnly: false,
    copyNodeModules: true,
    copyNodeRuntime: true,
    copyBrowserCache: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--release-dir":
        result.releaseDir = argv[++index];
        break;
      case "--skip-build":
        result.skipBuild = true;
        break;
      case "--portable-only":
        result.portableOnly = true;
        break;
      case "--no-node-modules":
        result.copyNodeModules = false;
        break;
      case "--no-node-runtime":
        result.copyNodeRuntime = false;
        break;
      case "--no-browser-cache":
        result.copyBrowserCache = false;
        break;
      case "--help":
      case "-h":
        printHelpAndExit();
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }

  return result;
}

function printHelpAndExit() {
  console.log(`Usage: node scripts/build-release.mjs [options]

Options:
  --release-dir <path>    发布目录，默认 ../ieta-dyna-snapshot-release
  --skip-build            跳过 pnpm type-check 和 pnpm build
  --portable-only         只生成跨平台发布骨架，不复制当前平台 node_modules/Node/浏览器缓存
  --no-node-modules       不复制当前 node_modules
  --no-node-runtime       不复制当前 Node 运行时
  --no-browser-cache      不复制当前 Playwright 浏览器缓存
`);
  process.exit(0);
}

function run(command, commandArgs, cwd) {
  const executable = command === "pnpm" ? detectPnpmExecutable() : command;
  console.log(`> ${[executable, ...commandArgs].join(" ")}`);
  const useShell = process.platform === "win32" && /\.cmd$/i.test(executable);
  const result = spawnSync(executable, commandArgs, {
    cwd,
    stdio: "inherit",
    shell: useShell,
  });
  if (result.error) {
    throw new Error(`命令启动失败: ${[executable, ...commandArgs].join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`命令失败: ${[executable, ...commandArgs].join(" ")}`);
  }
}

function detectPnpmExecutable() {
  if (process.platform !== "win32") return "pnpm";
  const besideNode = join(dirname(process.execPath), "pnpm.cmd");
  if (existsSync(besideNode)) return besideNode;
  return "pnpm.cmd";
}

async function ensureSafeReleaseRoot(target) {
  if (target === repoRoot) throw new Error("发布目录不能等于源码目录。");
  const parent = dirname(target);
  if (!parent || parent === target) throw new Error("发布目录不能是文件系统根目录。");
  const rel = relative(repoRoot, target);
  if (!rel.startsWith("..") && !isAbsolute(rel)) {
    throw new Error("发布目录不能位于源码目录内部，请使用同级或其他独立目录。");
  }
}

async function copyProjectArtifacts() {
  await mkdir(join(releaseRoot, "apps", "api"), { recursive: true });
  await mkdir(join(releaseRoot, "apps", "web"), { recursive: true });
  await mkdir(join(releaseRoot, "packages", "shared"), { recursive: true });
  await mkdir(join(releaseRoot, "runtime"), { recursive: true });
  await mkdir(join(releaseRoot, "data"), { recursive: true });
  await mkdir(join(releaseRoot, "logs"), { recursive: true });
  await mkdir(join(releaseRoot, "tests"), { recursive: true });
  await mkdir(join(releaseRoot, "docs"), { recursive: true });

  await cp(join(repoRoot, "apps", "api", "dist"), join(releaseRoot, "apps", "api", "dist"), { recursive: true });
  await cp(join(repoRoot, "apps", "web", "dist"), join(releaseRoot, "apps", "web", "dist"), { recursive: true });
  await cp(join(repoRoot, "packages", "shared", "dist"), join(releaseRoot, "packages", "shared", "dist"), { recursive: true });

  await writeJson(join(releaseRoot, "package.json"), releaseRootPackage());
  await writeJson(join(releaseRoot, "apps", "api", "package.json"), await readJson(join(repoRoot, "apps", "api", "package.json")));
  await writeJson(join(releaseRoot, "packages", "shared", "package.json"), releaseSharedPackage(await readJson(join(repoRoot, "packages", "shared", "package.json"))));
  await cp(join(repoRoot, "pnpm-lock.yaml"), join(releaseRoot, "pnpm-lock.yaml"));
  await cp(join(repoRoot, "pnpm-workspace.yaml"), join(releaseRoot, "pnpm-workspace.yaml"));

  await writeFile(join(releaseRoot, ".npmrc"), "store-dir=.pnpm-store\nvirtual-store-dir=node_modules/.pnpm\n", "utf8");
  await writeFile(join(releaseRoot, ".env"), defaultEnv(), "utf8");
}

async function writeRuntimeFiles() {
  await writeFile(join(releaseRoot, "start.cmd"), startCmd(), "utf8");
  await writeFile(join(releaseRoot, "start.sh"), startSh(), "utf8");
  await writeFile(join(releaseRoot, "install-runtime.ps1"), installRuntimePs1(), "utf8");
  await writeFile(join(releaseRoot, "install-runtime.sh"), installRuntimeSh(), "utf8");
  await writeFile(join(releaseRoot, "test-release.cmd"), testReleaseCmd(), "utf8");
  await writeFile(join(releaseRoot, "test-release.sh"), testReleaseSh(), "utf8");
  await writeFile(join(releaseRoot, "runtime", "supervisor.mjs"), supervisorMjs(), "utf8");
  await writeFile(join(releaseRoot, "runtime", "web-server.mjs"), webServerMjs(), "utf8");
  await writeFile(join(releaseRoot, "tests", "release-smoke.mjs"), releaseSmokeMjs(), "utf8");
}

async function writeDocumentation() {
  await writeFile(join(releaseRoot, "README.md"), releaseReadme(), "utf8");
  await writeFile(join(releaseRoot, "docs", "安装使用手册.md"), installManual(), "utf8");
  await writeFile(join(releaseRoot, "docs", "测试文档.md"), testManual(), "utf8");
}

async function writeManifest() {
  const manifest = {
    name: "ieta-dyna-snapshot-release",
    generatedAt: new Date().toISOString(),
    sourceRoot: repoRoot,
    sourceBranch: git(["branch", "--show-current"]),
    sourceCommit: git(["rev-parse", "--short", "HEAD"]),
    releaseRoot,
    portableOnly,
    includesCurrentNodeModules: copyNodeModules,
    includesCurrentNodeRuntime: copyNodeRuntime,
    includesCurrentPlaywrightCache: copyBrowserCache,
    supportedTargets: ["Windows x64", "Linux ARM64"],
  };
  await writeJson(join(releaseRoot, "release-manifest.json"), manifest);
}

function git(commandArgs) {
  const result = spawnSync("git", commandArgs, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

async function copyOptional(source, target, warnings, label) {
  try {
    if (!source || !existsSync(source)) {
      warnings.push(`未找到 ${label}，已跳过复制。`);
      return;
    }
    console.log(`复制 ${label} -> ${target}`);
    await cp(source, target, {
      recursive: true,
      force: true,
      dereference: false,
      verbatimSymlinks: false,
    });
  } catch (error) {
    warnings.push(`复制 ${label} 失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function detectNodeRuntimeRoot() {
  const executable = process.execPath;
  const binDir = dirname(executable);
  if (basename(binDir).toLowerCase() === "bin") return dirname(binDir);
  if (process.platform === "win32" && basename(executable).toLowerCase() === "node.exe") return binDir;
  return undefined;
}

function detectPlaywrightCacheRoot() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0") {
    return resolve(process.env.PLAYWRIGHT_BROWSERS_PATH);
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, "ms-playwright");
  }
  if (process.env.HOME) return join(process.env.HOME, ".cache", "ms-playwright");
  return undefined;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await writeFile(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rm(file, { force: true });
  await cp(`${file}.tmp`, file);
  await rm(`${file}.tmp`, { force: true });
}

function releaseRootPackage() {
  return {
    name: "ieta-dyna-snapshot-release",
    version: "0.1.0",
    private: true,
    packageManager: "pnpm@10.33.0",
    scripts: {
      start: "node runtime/supervisor.mjs",
      "install:runtime": "pnpm install --prod --frozen-lockfile",
      "browser:install": "pnpm --filter @ieta-dyna-snapshot/api exec playwright install chromium",
      "test:release": "node tests/release-smoke.mjs",
    },
    engines: {
      node: ">=20",
      pnpm: ">=8",
    },
  };
}

function releaseSharedPackage(pkg) {
  return {
    name: pkg.name,
    version: pkg.version,
    private: true,
    type: pkg.type,
    main: "dist/index.js",
    types: "dist/index.d.ts",
  };
}

function defaultEnv() {
  return `NODE_ENV=production
API_HOST=127.0.0.1
API_PORT=4310
WEB_HOST=127.0.0.1
WEB_PORT=4311
CORS_ORIGINS=http://127.0.0.1:4311,http://localhost:4311
JWT_SECRET=change-me-before-production-use
JWT_EXPIRES_IN=8h
DB_TYPE=sqlite
SQLITE_PATH=./data/app.db
SNAPSHOT_BROWSER_PROFILE_ROOT=./runtime/browser-profiles
SNAPSHOT_BROWSER_HEADLESS=true
PLAYWRIGHT_BROWSERS_PATH=./runtime/ms-playwright
# Linux ARM64 如需使用系统 Chromium，请取消下一行注释并改成真实路径。
# PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
`;
}

function startCmd() {
  return `@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE=%~dp0runtime\\node\\windows-x64\\bin\\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=%~dp0runtime\\node\\windows-x64\\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%~dp0runtime\\supervisor.mjs"
`;
}

function startSh() {
  return `#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"
NODE_EXE="$ROOT/runtime/node/linux-arm64/bin/node"
if [ ! -x "$NODE_EXE" ]; then NODE_EXE="$ROOT/runtime/node/linux-arm64/node"; fi
if [ ! -x "$NODE_EXE" ]; then NODE_EXE="node"; fi
exec "$NODE_EXE" "$ROOT/runtime/supervisor.mjs"
`;
}

function installRuntimePs1() {
  return `$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $Root "runtime\\ms-playwright"
pnpm install --prod --frozen-lockfile
pnpm --filter "@ieta-dyna-snapshot/api" exec playwright install chromium
Write-Host "运行依赖安装完成。启动命令：.\\start.cmd"
`;
}

function installRuntimeSh() {
  return `#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"
export PLAYWRIGHT_BROWSERS_PATH="$ROOT/runtime/ms-playwright"
pnpm install --prod --frozen-lockfile
pnpm --filter "@ieta-dyna-snapshot/api" exec playwright install chromium
echo "运行依赖安装完成。启动命令：./start.sh"
`;
}

function testReleaseCmd() {
  return `@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE=%~dp0runtime\\node\\windows-x64\\bin\\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=%~dp0runtime\\node\\windows-x64\\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%~dp0tests\\release-smoke.mjs"
`;
}

function testReleaseSh() {
  return `#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"
NODE_EXE="$ROOT/runtime/node/linux-arm64/bin/node"
if [ ! -x "$NODE_EXE" ]; then NODE_EXE="$ROOT/runtime/node/linux-arm64/node"; fi
if [ ! -x "$NODE_EXE" ]; then NODE_EXE="node"; fi
exec "$NODE_EXE" "$ROOT/tests/release-smoke.mjs"
`;
}

function supervisorMjs() {
  return `import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = normalizeEnv({ ...process.env, ...readEnv(join(root, ".env")) });
mkdirSync(join(root, "logs"), { recursive: true });

const children = [
  start("api", [join(root, "apps", "api", "dist", "main.js")]),
  start("web", [join(root, "runtime", "web-server.mjs")]),
];

console.log("Dyna Snapshot 已启动");
console.log("Web 控制台: http://" + env.WEB_HOST + ":" + env.WEB_PORT);
console.log("API 服务: http://" + env.API_HOST + ":" + env.API_PORT);
console.log("Swagger: http://" + env.API_HOST + ":" + env.API_PORT + "/api/docs");
console.log("按 Ctrl+C 停止服务。");

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopAll(signal));
}

function start(name, args) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  const log = createWriteStream(join(root, "logs", name + ".log"), { flags: "a" });
  child.stdout.on("data", (chunk) => {
    process.stdout.write("[" + name + "] " + chunk);
    log.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write("[" + name + "] " + chunk);
    log.write(chunk);
  });
  child.on("exit", (code, signal) => {
    log.end();
    if (!shuttingDown && code !== 0) {
      console.error(name + " 进程退出，code=" + code + ", signal=" + signal);
      stopAll("child-exit");
    }
  });
  return child;
}

function stopAll(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("正在停止服务: " + reason);
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(0), 500);
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  const parsed = {};
  for (const line of readFileSync(file, "utf8").split(/\\r?\\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    parsed[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return parsed;
}

function normalizeEnv(raw) {
  const next = { ...raw };
  for (const key of ["SQLITE_PATH", "SNAPSHOT_BROWSER_PROFILE_ROOT", "PLAYWRIGHT_BROWSERS_PATH"]) {
    if (next[key] && !isAbsolute(next[key])) next[key] = resolve(root, next[key]);
  }
  next.API_HOST ||= "127.0.0.1";
  next.API_PORT ||= "4310";
  next.WEB_HOST ||= "127.0.0.1";
  next.WEB_PORT ||= "4311";
  return next;
}
`;
}

function webServerMjs() {
  return `import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, ...readEnv(join(root, ".env")) };
const host = env.WEB_HOST || "127.0.0.1";
const port = Number(env.WEB_PORT || 4311);
const apiHost = env.API_HOST || "127.0.0.1";
const apiPort = Number(env.API_PORT || 4310);
const webRoot = join(root, "apps", "web", "dist");

createServer((req, res) => {
  if (req.url?.startsWith("/api")) return proxyApi(req, res);
  return serveStatic(req, res);
}).listen(port, host, () => {
  console.log("Web listening on http://" + host + ":" + port);
});

function proxyApi(req, res) {
  const target = new URL(req.url || "/", "http://" + apiHost + ":" + apiPort);
  const client = target.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = { ...req.headers, host: target.host };
  const upstream = client(target, { method: req.method, headers }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("API 代理失败: " + error.message);
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://local");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const candidate = resolve(webRoot, "." + pathname);
  const pathFromRoot = relative(webRoot, candidate);
  const file = pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)
    ? join(webRoot, "index.html")
    : candidate;
  const finalFile = existsSync(file) && statSync(file).isFile() ? file : join(webRoot, "index.html");
  res.writeHead(200, { "content-type": mime(finalFile) });
  createReadStream(finalFile).pipe(res);
}

function mime(file) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  }[extname(file).toLowerCase()] || "application/octet-stream";
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  const parsed = {};
  for (const line of readFileSync(file, "utf8").split(/\\r?\\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    parsed[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return parsed;
}
`;
}

function releaseSmokeMjs() {
  return `import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smokeRoot = join(root, "data", "release-smoke");

process.env.NODE_ENV = "production";
process.env.SQLITE_PATH = join(smokeRoot, "app.db");
process.env.SNAPSHOT_BROWSER_PROFILE_ROOT = join(smokeRoot, "browser-profiles");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, "runtime", "ms-playwright");

if (!existsSync(join(root, "apps", "api", "dist", "app.module.js"))) {
  console.error("API 构建产物不存在，请重新生成发布目录。");
  process.exit(1);
}

require("reflect-metadata");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../apps/api/dist/app.module.js");
const { SnapshotService } = require("../apps/api/dist/modules/projects/snapshot.service.js");

const fixtureHtml = \`<!doctype html>
<html><head><meta charset="utf-8"><title>Release Smoke</title>
<style>body{font-family:Arial,sans-serif;padding:24px}#capture{width:520px;border:1px solid #b8c4d4;padding:16px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #d5dce7;padding:6px 8px;text-align:left}</style>
</head><body><section id="capture"><h1>Release Smoke Fixture</h1><label>Keyword <input id="keyword"></label><table id="metrics"><tr><th>Name</th><th>Value</th></tr><tr><td>Alpha</td><td>10</td></tr><tr><td>Beta</td><td>20</td></tr></table></section></body></html>\`;

const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(fixtureHtml);
});

try {
  await rm(smokeRoot, { force: true, recursive: true });
  await mkdir(smokeRoot, { recursive: true });
  const port = await listen(server);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const service = app.get(SnapshotService);
    const code = "REL" + Date.now();
    const project = await service.createProject({
      code,
      name: "Release Smoke Project",
      assetRoot: join(smokeRoot, "assets", code),
    });
    const system = await service.createSystem({
      projectId: project.id,
      code: "FIXTURE",
      name: "Local Fixture",
      baseUrl: "http://127.0.0.1:" + port + "/",
    });
    await service.createPlan({
      projectId: project.id,
      externalSystemId: system.id,
      code: "BASIC",
      name: "Basic Capture",
      steps: [
        { id: "open", type: "goto", name: "Open fixture" },
        { id: "fill-keyword", type: "fill", name: "Fill keyword", selector: "#keyword", value: "{{keyword}}" },
        { id: "shot-card", type: "screenshotElement", name: "Capture card", selector: "#capture" },
        { id: "table-metrics", type: "extractTable", name: "Extract metrics", selector: "#metrics" },
      ],
      inputSchema: [{ name: "keyword", label: "Keyword", type: "string", required: true, secure: false }],
    });
    const run = await service.triggerRun({ projectCode: code, planCodes: ["BASIC"], parameters: { keyword: "Beta" }, source: "api" });
    const steps = await service.listRunSteps(run.id);
    const assets = await service.listAssets(run.id);
    const jsonAsset = assets.find((asset) => asset.contentType === "application/json");
    const tableJson = jsonAsset ? JSON.parse(await readFile(jsonAsset.filePath, "utf8")) : undefined;
    const summary = {
      status: run.status,
      stepStatus: steps.map((step) => ({ stepId: step.stepId, status: step.status })),
      assetCount: assets.length,
      tableRows: tableJson?.rows?.length || 0,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (run.status !== "succeeded") throw new Error("采集运行失败: " + run.errorMessage);
    if (steps.some((step) => step.status !== "succeeded")) throw new Error("存在未成功步骤");
    if (!assets.some((asset) => asset.contentType === "image/png")) throw new Error("缺少 PNG 截图资产");
    if (!assets.some((asset) => asset.contentType === "application/json")) throw new Error("缺少 JSON 表格资产");
    if (!assets.some((asset) => asset.contentType === "text/csv")) throw new Error("缺少 CSV 表格资产");
    if (summary.tableRows !== 2) throw new Error("表格行数不符合预期");
    console.log("发布包自检通过。");
  } finally {
    await app.close();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await close(server);
}

function listen(target) {
  return new Promise((resolveListen, rejectListen) => {
    target.once("error", rejectListen);
    target.listen(0, "127.0.0.1", () => resolveListen(target.address().port));
  });
}

function close(target) {
  return new Promise((resolveClose) => target.close(resolveClose));
}
`;
}

function releaseReadme() {
  return `# ieta-dyna-snapshot 发布包

这是 ieta-dyna-snapshot 的运行态发布目录，包含后端 API 构建产物、前端静态资源、跨平台启动脚本、运行配置、安装说明和测试脚本。

快速启动：

\`\`\`powershell
.\\start.cmd
\`\`\`

\`\`\`bash
chmod +x ./start.sh ./install-runtime.sh ./test-release.sh
./start.sh
\`\`\`

详细说明见：

- [安装使用手册](docs/安装使用手册.md)
- [测试文档](docs/测试文档.md)
`;
}

function installManual() {
  return `# 安装使用手册

## 目录结构

- \`apps/api/dist\`：NestJS 后端运行产物。
- \`apps/web/dist\`：Vue 前端静态资源。
- \`runtime\`：Node、Playwright 浏览器缓存、浏览器用户资料、前端静态代理服务等运行资源。
- \`data\`：SQLite 数据库和采集资产默认存放目录。
- \`logs\`：启动后的 API 和 Web 日志。
- \`.env\`：运行配置。

## Windows x64

如果发布脚本已复制当前 Windows 运行态，可直接启动：

\`\`\`powershell
cd E:\\CodexDev\\ieta-dyna-snapshot-release
.\\start.cmd
\`\`\`

如果需要在另一台 Windows 机器上重新安装依赖：

\`\`\`powershell
cd E:\\CodexDev\\ieta-dyna-snapshot-release
.\\install-runtime.ps1
.\\start.cmd
\`\`\`

## Linux ARM64

在 Linux ARM64 上复制同一个发布目录后，先安装目标平台依赖：

\`\`\`bash
cd /opt/ieta-dyna-snapshot-release
chmod +x ./install-runtime.sh ./start.sh ./test-release.sh
./install-runtime.sh
./start.sh
\`\`\`

如果 Playwright 托管 Chromium 在 Linux ARM64 上不可用，请安装系统 Chromium，并在 \`.env\` 中配置：

\`\`\`env
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
\`\`\`

## 常用配置

- \`API_HOST\` / \`API_PORT\`：后端监听地址，默认 \`127.0.0.1:4310\`。
- \`WEB_HOST\` / \`WEB_PORT\`：前端访问地址，默认 \`127.0.0.1:4311\`。
- \`SQLITE_PATH\`：数据库文件，默认 \`./data/app.db\`。
- \`SNAPSHOT_BROWSER_PROFILE_ROOT\`：浏览器登录态和用户资料目录，默认 \`./runtime/browser-profiles\`。
- \`PLAYWRIGHT_BROWSERS_PATH\`：Playwright 浏览器缓存目录，默认 \`./runtime/ms-playwright\`。
- \`JWT_SECRET\`：生产使用前必须修改。

## 访问地址

- Web 控制台：\`http://127.0.0.1:4311\`
- API 服务：\`http://127.0.0.1:4310\`
- Swagger：\`http://127.0.0.1:4310/api/docs\`

默认管理员：

\`\`\`text
username: admin
password: admin123456
\`\`\`
`;
}

function testManual() {
  return `# 测试文档

## 1. 发布包自检

Windows：

\`\`\`powershell
cd E:\\CodexDev\\ieta-dyna-snapshot-release
.\\test-release.cmd
\`\`\`

Linux ARM64：

\`\`\`bash
cd /opt/ieta-dyna-snapshot-release
./test-release.sh
\`\`\`

自检会启动一个本地测试页面，执行页面打开、输入填充、元素截图、表格 JSON/CSV 提取，并检查采集资产是否生成。

## 2. 启动后检查

启动系统：

\`\`\`powershell
.\\start.cmd
\`\`\`

或：

\`\`\`bash
./start.sh
\`\`\`

浏览器打开：

- \`http://127.0.0.1:4311\`
- 使用 \`admin / admin123456\` 登录。
- 打开 Swagger：\`http://127.0.0.1:4310/api/docs\`。

## 3. 运行数据检查

- 数据库文件应生成在 \`data/app.db\`。
- 采集资产默认生成在项目配置的资产根目录，建议使用 \`data/assets/<项目编码>\`。
- 日志文件在 \`logs/api.log\` 和 \`logs/web.log\`。

## 4. 常见问题

- 如果提示找不到 Node：安装 Node 20+，或把对应平台 Node 放入 \`runtime/node/windows-x64\` 或 \`runtime/node/linux-arm64\`。
- 如果提示找不到浏览器：执行 \`install-runtime\` 脚本安装 Chromium，或配置 \`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH\`。
- 如果端口被占用：修改 \`.env\` 中的 \`API_PORT\` 和 \`WEB_PORT\`。
`;
}
