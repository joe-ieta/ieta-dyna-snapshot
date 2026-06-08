import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { mkdir, rm, stat } from "fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "path";
import { chromium } from "playwright";
import { DomainError } from "../../common/errors/domain-error";
import { RenderUrlDto, RenderOutputType } from "./dto/render-url.dto";

export type RenderedUrlAsset = {
  fileName: string;
  filePath: string;
  contentType: string;
  sizeBytes: number;
};

export type RenderedUrlAssetAccess = {
  expires: number;
  token: string;
};

@Injectable()
export class UrlRendererService {
  constructor(private readonly config: ConfigService) {}

  async renderUrl(payload: RenderUrlDto): Promise<RenderedUrlAsset> {
    const outputType = payload.outputType;
    const fileName = `${payload.fileNameId}.${this.extensionFor(outputType)}`;
    const filePath = this.resolveAssetPath(fileName);

    await mkdir(this.assetsRoot(), { recursive: true });
    await rm(filePath, { force: true });

    const browser = await chromium.launch(this.launchOptions());
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        extraHTTPHeaders: this.normalizeHeaders(payload.headers),
      });
      await page.goto(payload.url, {
        waitUntil: payload.waitUntil || "networkidle",
        timeout: payload.timeoutMs || 30000,
      });

      if (outputType === "pdf") {
        await page.pdf({
          path: filePath,
          format: "A4",
          printBackground: true,
        });
      } else {
        await page.screenshot({
          path: filePath,
          fullPage: true,
          type: outputType === "jpg" ? "jpeg" : "png",
          ...(outputType === "jpg" ? { quality: 90 } : {}),
        });
      }
    } catch (error) {
      throw new DomainError(
        "CAPTURE_FAILED",
        `Failed to render URL: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      await browser.close().catch(() => undefined);
    }

    const info = await stat(filePath);
    return {
      fileName,
      filePath,
      contentType: this.contentTypeFor(outputType),
      sizeBytes: info.size,
    };
  }

  async getAsset(fileName: string): Promise<RenderedUrlAsset> {
    const filePath = this.resolveAssetPath(fileName);
    const extension = extname(fileName).toLowerCase();
    const outputType = extension === ".pdf" ? "pdf" : extension === ".png" ? "png" : extension === ".jpg" ? "jpg" : undefined;
    if (!outputType) {
      throw new DomainError("ASSET_NOT_FOUND", "Unsupported rendered asset type", HttpStatus.NOT_FOUND);
    }

    try {
      const info = await stat(filePath);
      return {
        fileName,
        filePath,
        contentType: this.contentTypeFor(outputType),
        sizeBytes: info.size,
      };
    } catch {
      throw new DomainError("ASSET_NOT_FOUND", `Rendered asset not found: ${fileName}`, HttpStatus.NOT_FOUND);
    }
  }

  createAssetAccess(fileName: string): RenderedUrlAssetAccess {
    this.resolveAssetPath(fileName);
    const ttlSeconds = Math.max(60, Number(this.config.get<string>("SNAPSHOT_TOOL_ASSET_URL_TTL_SECONDS", "3600")));
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    return {
      expires,
      token: this.signAssetAccess(fileName, expires),
    };
  }

  validateAssetAccess(fileName: string, token?: string, expires?: string) {
    const expiresNumber = Number(expires);
    if (!token || !Number.isInteger(expiresNumber)) {
      throw new DomainError("ASSET_ACCESS_DENIED", "Missing rendered asset access token", HttpStatus.UNAUTHORIZED);
    }
    if (expiresNumber < Math.floor(Date.now() / 1000)) {
      throw new DomainError("ASSET_ACCESS_DENIED", "Rendered asset access token expired", HttpStatus.UNAUTHORIZED);
    }

    const expected = this.signAssetAccess(fileName, expiresNumber);
    if (!this.safeEquals(token, expected)) {
      throw new DomainError("ASSET_ACCESS_DENIED", "Invalid rendered asset access token", HttpStatus.UNAUTHORIZED);
    }
  }

  private assetsRoot() {
    const configuredRoot = this.config.get<string>("SNAPSHOT_TOOL_ASSET_ROOT");
    if (configuredRoot) return resolve(process.cwd(), configuredRoot);

    const sqlitePath = resolve(process.cwd(), this.config.get<string>("SQLITE_PATH", "../../data/app.db"));
    return resolve(dirname(sqlitePath), "assets", "tools");
  }

  private resolveAssetPath(fileName: string) {
    const assetsRoot = this.assetsRoot();
    const normalized = fileName.replace(/\\/g, "/");
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.(pdf|png|jpg)$/.test(normalized)) {
      throw new DomainError("INPUT_VALIDATION_FAILED", "Invalid rendered asset file name", HttpStatus.BAD_REQUEST);
    }

    const filePath = resolve(assetsRoot, normalized);
    const pathFromRoot = relative(assetsRoot, filePath);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      throw new DomainError("INPUT_VALIDATION_FAILED", "Rendered asset path escapes assets root", HttpStatus.BAD_REQUEST);
    }
    return filePath;
  }

  private normalizeHeaders(headers?: Record<string, string>) {
    if (!headers) return undefined;
    return Object.fromEntries(
      Object.entries(headers)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value]),
    );
  }

  private launchOptions() {
    const executablePath = this.config.get<string>("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH");
    return {
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    };
  }

  private extensionFor(outputType: RenderOutputType) {
    return outputType === "jpg" ? "jpg" : outputType;
  }

  private contentTypeFor(outputType: RenderOutputType) {
    if (outputType === "pdf") return "application/pdf";
    if (outputType === "png") return "image/png";
    return "image/jpeg";
  }

  private signAssetAccess(fileName: string, expires: number) {
    return createHmac("sha256", this.assetAccessSecret())
      .update(`${fileName}:${expires}`)
      .digest("base64url");
  }

  private assetAccessSecret() {
    return this.config.get<string>("SNAPSHOT_TOOL_ASSET_URL_SECRET")
      || this.config.get<string>("JWT_SECRET")
      || "local-tool-asset-url-secret";
  }

  private safeEquals(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
