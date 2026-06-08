# Tools Render URL API 测试样例

本文档用于验证工具类接口：把一个可访问 URL 渲染为 `pdf`、`png` 或 `jpg` 文件，并返回生成文件的访问地址。

## 1. 接口说明

### 1.1 生成文件

```http
POST /api/v1/tools/render-url
```

认证方式：

- Web 登录后的 `Authorization: Bearer <jwt>`。
- 外部调用推荐使用 `X-API-Token: <token>`。

请求体：

```json
{
  "url": "http://127.0.0.1:4310/api/health",
  "outputType": "png",
  "fileNameId": "health-page",
  "waitUntil": "domcontentloaded",
  "timeoutMs": 30000
}
```

参数说明：

| 参数 | 必填 | 说明 |
|---|---:|---|
| `url` | 是 | 要访问并渲染的页面地址。仅支持 `http` 和 `https`。 |
| `outputType` | 是 | 输出格式：`pdf`、`png`、`jpg`。 |
| `fileNameId` | 是 | 输出文件主名称，只允许字母、数字、下划线、短横线、点号，不能包含路径分隔符。 |
| `headers` | 否 | 访问目标 URL 时附加的 HTTP header。 |
| `waitUntil` | 否 | 页面等待策略：`load`、`domcontentloaded`、`networkidle`，默认 `networkidle`。 |
| `timeoutMs` | 否 | 页面访问超时时间，范围 `1000` 到 `120000` 毫秒，默认 `30000`。 |

保存规则：

- 文件保存到数据目录下的 `assets/tools`。
- 默认开发环境 `.env.example` 中 `SQLITE_PATH=../../data/app.db`，因此文件落在仓库根目录 `data/assets/tools`。
- 发布包环境 `SQLITE_PATH=./data/app.db`，因此文件落在发布包目录 `data/assets/tools`。
- 如果配置 `SNAPSHOT_TOOL_ASSET_ROOT`，则使用该目录作为工具资产根目录。
- `SNAPSHOT_TOOL_ASSET_ROOT` 可以是绝对路径，也可以是相对 API 进程当前工作目录的相对路径；生产环境建议使用绝对路径或发布包内相对路径。
- `SNAPSHOT_TOOL_ASSET_URL_SECRET` 用于签名浏览器可直接访问的文件 URL；如果不配置，会回退使用 `JWT_SECRET`。
- `SNAPSHOT_TOOL_ASSET_URL_TTL_SECONDS` 控制签名 URL 有效期，默认 `3600` 秒。
- 同名文件会先删除再重新生成，即覆盖模式。
- 渲染过程使用 Playwright Chromium `headless` 后台模式，不打开可见浏览器窗口。

成功响应：

```json
{
  "success": true,
  "fileName": "health-page.png",
  "contentType": "image/png",
  "sizeBytes": 7459,
  "filePath": "E:\\CodexDev\\ieta-dyna-snapshot\\data\\assets\\tools\\health-page.png",
  "assetUrl": "http://127.0.0.1:4310/api/v1/tools/assets/health-page.png?expires=1781010000&token=..."
}
```

失败响应：

```json
{
  "success": false,
  "code": "INPUT_VALIDATION_FAILED",
  "message": "Request validation failed",
  "details": [
    {
      "field": "url",
      "constraints": {
        "isUrl": "url must be a URL address"
      }
    }
  ]
}
```

### 1.2 读取生成文件

```http
GET /api/v1/tools/assets/{fileName}
```

示例：

```http
GET /api/v1/tools/assets/health-page.png
```

该接口返回文件二进制内容。由于响应体就是文件本身，不再包装 `success` 字段；调用方应通过 HTTP 状态码判断读取是否成功。

`POST /api/v1/tools/render-url` 返回的 `assetUrl` 会自动附带 `expires` 和 `token` 查询参数。该签名 URL 可以直接复制到浏览器地址栏访问，不需要浏览器额外设置 `Authorization` 请求头。不要手工删除 `assetUrl` 后面的查询参数；没有签名参数或签名过期时，接口会返回 `success: false`。

## 2. Postman 调用样例

### 2.1 准备环境

1. 启动 API 服务。
2. 确认 API 地址，例如 `http://127.0.0.1:4310`。
3. 准备认证信息：
   - 使用 `X-API-Token`：在 `.env` 中配置 `SNAPSHOT_API_TOKEN`。
   - 或先调用 `/api/auth/login` 获取 JWT。

### 2.2 生成 PNG

Postman 设置：

- Method: `POST`
- URL: `http://127.0.0.1:4310/api/v1/tools/render-url`
- Headers:
  - `Content-Type: application/json`
  - `X-API-Token: {{SNAPSHOT_API_TOKEN}}`
- Body: `raw` / `JSON`

```json
{
  "url": "http://127.0.0.1:4310/api/health",
  "outputType": "png",
  "fileNameId": "health-page",
  "waitUntil": "domcontentloaded",
  "timeoutMs": 30000
}
```

断言建议：

- HTTP 状态码为 `200`。
- 响应 JSON 中 `success` 为 `true`。
- `fileName` 为 `health-page.png`。
- `assetUrl` 可以继续访问。

Postman Tests 示例：

```javascript
pm.test("render success", function () {
  pm.response.to.have.status(200);
  const body = pm.response.json();
  pm.expect(body.success).to.eql(true);
  pm.expect(body.fileName).to.eql("health-page.png");
  pm.expect(body.assetUrl).to.be.a("string");
});
```

### 2.3 生成 PDF

Body:

```json
{
  "url": "http://127.0.0.1:4310/api/health",
  "outputType": "pdf",
  "fileNameId": "health-page-pdf",
  "waitUntil": "domcontentloaded"
}
```

成功后访问响应中的 `assetUrl`，返回内容类型应为 `application/pdf`。

### 2.4 生成 JPG

Body:

```json
{
  "url": "http://127.0.0.1:4310/api/health",
  "outputType": "jpg",
  "fileNameId": "health-page-jpg",
  "waitUntil": "domcontentloaded"
}
```

成功后访问响应中的 `assetUrl`，返回内容类型应为 `image/jpeg`。

### 2.5 失败样例

Body:

```json
{
  "url": "ftp://example.com",
  "outputType": "png",
  "fileNameId": "bad-url"
}
```

期望：

- HTTP 状态码为 `422`。
- 响应 JSON 中 `success` 为 `false`。
- `code` 为 `INPUT_VALIDATION_FAILED`。

## 3. curl 调用样例

### 3.1 Linux / macOS / Git Bash

```bash
export SNAPSHOT_API_TOKEN="change-this-to-a-long-random-token"
export API_BASE="http://127.0.0.1:4310"

curl -sS -X POST "$API_BASE/api/v1/tools/render-url" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  -d '{
    "url": "http://127.0.0.1:4310/api/health",
    "outputType": "png",
    "fileNameId": "health-page",
    "waitUntil": "domcontentloaded",
    "timeoutMs": 30000
  }'
```

下载生成文件：

```bash
curl -L \
  -o health-page.png \
  "把上一步响应里的完整 assetUrl 粘贴到这里"
```

### 3.2 Windows PowerShell

```powershell
$env:SNAPSHOT_API_TOKEN = "change-this-to-a-long-random-token"
$ApiBase = "http://127.0.0.1:4310"

curl.exe -sS -X POST "$ApiBase/api/v1/tools/render-url" `
  -H "Content-Type: application/json" `
  -H "X-API-Token: $env:SNAPSHOT_API_TOKEN" `
  --data-raw '{
    "url": "http://127.0.0.1:4310/api/health",
    "outputType": "png",
    "fileNameId": "health-page",
    "waitUntil": "domcontentloaded",
    "timeoutMs": 30000
  }'
```

下载生成文件：

```powershell
curl.exe -L `
  -o health-page.png `
  "把上一步响应里的完整 assetUrl 粘贴到这里"
```

### 3.3 PDF 与 JPG

PDF:

```bash
curl -sS -X POST "$API_BASE/api/v1/tools/render-url" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  -d '{"url":"http://127.0.0.1:4310/api/health","outputType":"pdf","fileNameId":"health-page-pdf"}'
```

JPG:

```bash
curl -sS -X POST "$API_BASE/api/v1/tools/render-url" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: $SNAPSHOT_API_TOKEN" \
  -d '{"url":"http://127.0.0.1:4310/api/health","outputType":"jpg","fileNameId":"health-page-jpg"}'
```

## 4. Windows 与 Linux ARM64 兼容性检查

实现检查：

- 文件路径通过 Node `path.resolve`、`path.relative`、`path.dirname` 处理，没有硬编码 Windows 分隔符。
- `fileNameId` 禁止路径分隔符，并校验生成路径不能逃逸资产根目录。
- 文件覆盖使用 Node `fs.promises.rm`，Windows 和 Linux 均支持。
- 浏览器使用 Playwright `chromium.launch({ headless: true })`，不会打开桌面窗口。
- 若设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`，服务会使用该系统 Chromium；否则使用 Playwright 安装的 Chromium。

Windows x64:

```powershell
pnpm.cmd install
pnpm.cmd --filter "@ieta-dyna-snapshot/api" browser:install
pnpm.cmd dev:api
```

Ubuntu x86_64 / ARM64:

```bash
pnpm install
pnpm --filter @ieta-dyna-snapshot/api exec playwright install --with-deps chromium
pnpm dev:api
```

如果 Ubuntu ARM64 设备无法使用 Playwright 下载的浏览器，可以安装系统 Chromium，并在 `.env` 中配置：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

发布包环境下建议保持：

```bash
PLAYWRIGHT_BROWSERS_PATH=./runtime/ms-playwright
SNAPSHOT_TOOL_ASSET_ROOT=
```

如果要把工具输出独立放到指定目录，可配置：

```bash
SNAPSHOT_TOOL_ASSET_ROOT=./data/assets/tools
```

如果需要调整浏览器直连文件 URL 的有效期：

```bash
SNAPSHOT_TOOL_ASSET_URL_TTL_SECONDS=3600
SNAPSHOT_TOOL_ASSET_URL_SECRET=change-this-to-a-long-random-secret
```

## 5. 常见问题

### 5.1 返回 `CAPTURE_FAILED`

常见原因：

- 目标 URL 无法从 API 服务所在机器访问。
- 目标页面需要登录，但没有在 `headers` 中传入可用认证信息。
- 页面长时间没有达到 `waitUntil` 条件，可尝试 `domcontentloaded` 或增大 `timeoutMs`。
- Playwright 浏览器未安装或 Linux 缺少浏览器系统依赖。

### 5.2 目标页面需要 Header

请求体可以传入 `headers`：

```json
{
  "url": "https://example.com/report",
  "outputType": "pdf",
  "fileNameId": "report-20260608",
  "headers": {
    "Authorization": "Bearer your-page-token"
  }
}
```

注意：不要把长期有效的敏感凭据写入日志或共享测试集合。

### 5.3 生成文件已存在

同一个 `fileNameId` 和 `outputType` 会生成同名文件；服务会覆盖旧文件。
