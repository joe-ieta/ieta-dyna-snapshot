# Render URL 工具服务开发文档

本文档面向调用方开发人员，说明如何在业务系统、脚本、后端服务或前端管理工具中集成 `render-url` 工具服务。

## 1. 功能概览

`render-url` 工具服务用于把一个可访问的网页 URL 渲染为文件：

- `png`
- `jpg`
- `pdf`

调用方提交目标 URL、输出格式和文件名 ID。服务端使用 Playwright Chromium 在后台 `headless` 模式访问页面，将结果保存到运行数据目录下，并返回生成文件的访问地址。

典型场景：

- 把业务页面快照保存为图片。
- 把报表页面保存为 PDF。
- 由外部系统按需触发页面存档。
- 在自动化报告中插入页面截图或导出的 PDF 链接。

## 2. 接口清单

### 2.1 渲染 URL

```http
POST /api/v1/tools/render-url
```

该接口需要认证。

支持两类认证方式：

```http
Authorization: Bearer <jwt>
```

或：

```http
X-API-Token: <snapshot-api-token>
```

外部服务集成推荐使用 `X-API-Token`。人工调试或 Postman 调试也可以先调用 `/api/auth/login` 获取 JWT。

### 2.2 读取生成文件

```http
GET /api/v1/tools/assets/{fileName}?expires=...&token=...
```

该接口用于读取文件二进制内容。`render-url` 返回的 `assetUrl` 已经带有短期签名参数，可以直接放到浏览器地址栏访问，也可以由程序下载。

不要自行拼接或删除 `expires`、`token` 参数。

## 3. 请求模型

```json
{
  "url": "https://www.example.com/report",
  "outputType": "png",
  "fileNameId": "daily-report-20260609",
  "headers": {
    "Authorization": "Bearer page-access-token"
  },
  "waitUntil": "domcontentloaded",
  "timeoutMs": 30000
}
```

字段说明：

| 字段 | 必填 | 类型 | 说明 |
|---|---:|---|---|
| `url` | 是 | string | 目标网页地址，仅支持 `http` 和 `https`。 |
| `outputType` | 是 | string | 输出类型：`pdf`、`png`、`jpg`。 |
| `fileNameId` | 是 | string | 输出文件主名称。只允许字母、数字、下划线、短横线和点号。 |
| `headers` | 否 | object | 访问目标 URL 时附加的 HTTP headers。 |
| `waitUntil` | 否 | string | Playwright 页面等待策略：`load`、`domcontentloaded`、`networkidle`。 |
| `timeoutMs` | 否 | number | 访问目标页面的超时时间，范围 `1000` 到 `120000` 毫秒。 |

默认值：

- `waitUntil`: `networkidle`
- `timeoutMs`: `30000`

建议：

- 普通静态页面可使用 `domcontentloaded`，响应更快。
- 图表或异步数据较多的页面可使用 `networkidle`。
- 对第三方页面或可能有长连接的页面，优先尝试 `domcontentloaded`，避免等待网络空闲超时。

## 4. 响应模型

成功：

```json
{
  "success": true,
  "fileName": "daily-report-20260609.png",
  "contentType": "image/png",
  "sizeBytes": 102400,
  "filePath": "E:\\CodexDev\\ieta-dyna-snapshot\\data\\assets\\tools\\daily-report-20260609.png",
  "assetUrl": "http://127.0.0.1:4310/api/v1/tools/assets/daily-report-20260609.png?expires=1781010000&token=..."
}
```

失败：

```json
{
  "success": false,
  "code": "CAPTURE_FAILED",
  "message": "Failed to render URL: page.goto: Timeout 30000ms exceeded"
}
```

常见错误码：

| code | 说明 |
|---|---|
| `INPUT_VALIDATION_FAILED` | 请求参数不合法。 |
| `CAPTURE_FAILED` | Playwright 访问或渲染页面失败。 |
| `ASSET_NOT_FOUND` | 读取的生成文件不存在。 |
| `ASSET_ACCESS_DENIED` | 文件签名 URL 缺失、错误或已过期。 |

## 5. 文件保存与覆盖

保存目录：

- 默认保存到数据库文件所在目录下的 `assets/tools`。
- 开发环境默认是仓库根目录 `data/assets/tools`。
- 发行包环境默认是发行包目录 `data/assets/tools`。
- 可以通过 `SNAPSHOT_TOOL_ASSET_ROOT` 指定独立目录。

覆盖规则：

- 同一个 `fileNameId` 和 `outputType` 会生成同一个文件名。
- 生成前会删除同名旧文件。
- 如果需要保留历史文件，调用方应把日期、批次号或业务 ID 放入 `fileNameId`。

示例：

```json
{
  "fileNameId": "ops-dashboard-20260609-090000"
}
```

## 6. 签名 URL 规则

`assetUrl` 中的 `token` 是短期文件访问签名，不是 JWT，也不是 `X-API-Token`。

默认有效期：

```text
3600 秒
```

配置项：

```text
SNAPSHOT_TOOL_ASSET_URL_TTL_SECONDS=3600
SNAPSHOT_TOOL_ASSET_URL_SECRET=change-this-to-a-long-random-secret
```

安全注意：

- 拿到完整 `assetUrl` 的人，在过期前可以访问该文件。
- 不要把完整 `assetUrl` 写入不受控日志或公开页面。
- 敏感文件建议缩短有效期。
- 如果部署在反向代理后，确认访问日志策略不会长期保存查询参数。

## 7. JavaScript / TypeScript 调用示例

```ts
type RenderUrlResponse =
  | {
      success: true;
      fileName: string;
      contentType: string;
      sizeBytes: number;
      filePath: string;
      assetUrl: string;
    }
  | {
      success: false;
      code: string;
      message: string;
      details?: unknown;
    };

async function renderUrl() {
  const response = await fetch("http://127.0.0.1:4310/api/v1/tools/render-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Token": process.env.SNAPSHOT_API_TOKEN || "",
    },
    body: JSON.stringify({
      url: "https://www.baidu.com/",
      outputType: "png",
      fileNameId: "baidu-homepage",
      waitUntil: "domcontentloaded",
      timeoutMs: 30000,
    }),
  });

  const body = (await response.json()) as RenderUrlResponse;
  if (!body.success) {
    throw new Error(`${body.code}: ${body.message}`);
  }

  return body.assetUrl;
}
```

## 8. Node.js 下载生成文件示例

```ts
import { writeFile } from "node:fs/promises";

async function downloadAsset(assetUrl: string, outputPath: string) {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}
```

## 9. 目标页面需要认证

如果目标 URL 自身需要认证，可以通过 `headers` 传入目标页面所需的访问凭据：

```json
{
  "url": "https://example.com/private-report",
  "outputType": "pdf",
  "fileNameId": "private-report-20260609",
  "headers": {
    "Authorization": "Bearer target-page-token"
  }
}
```

注意：

- `headers` 是传给目标页面的，不是传给本系统 API 的。
- 本系统 API 的认证仍然通过 `Authorization` 或 `X-API-Token` 请求头传入。
- 不要把长期有效的目标系统凭据放入共享 Postman Collection。

## 10. Windows 与 Linux ARM64 注意事项

本功能没有平台专用路径写法，使用 Node.js 标准路径 API，可以运行在 Windows x64 和 Linux ARM64。

Windows:

```powershell
pnpm.cmd install
pnpm.cmd --filter "@ieta-dyna-snapshot/api" browser:install
pnpm.cmd dev:api
```

Ubuntu ARM64:

```bash
pnpm install
pnpm --filter @ieta-dyna-snapshot/api exec playwright install --with-deps chromium
pnpm dev:api
```

如果 Ubuntu ARM64 设备无法使用 Playwright 管理的 Chromium，可安装系统 Chromium，并配置：

```text
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

## 11. 开发自测清单

1. 启动 API。
2. 调用 `/api/auth/login` 或配置 `SNAPSHOT_API_TOKEN`。
3. 调用 `POST /api/v1/tools/render-url` 生成 `png`。
4. 将返回的完整 `assetUrl` 粘贴到浏览器地址栏，确认能直接打开。
5. 分别测试 `pdf` 和 `jpg`。
6. 使用非法 URL 测试失败响应，确认 `success` 为 `false`。
7. 使用相同 `fileNameId` 重复调用，确认文件会覆盖。
