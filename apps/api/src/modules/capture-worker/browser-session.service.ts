import { HttpStatus, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { access, mkdir, rm } from "fs/promises";
import { dirname, isAbsolute, relative, resolve } from "path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { DomainError } from "../../common/errors/domain-error";
import { ExternalSystemEntity } from "../../database/entities/external-system.entity";
import { ProjectEntity } from "../../database/entities/project.entity";

type LoginCheckRule = {
  required?: boolean;
  urlPattern?: string;
  urlIncludes?: string;
  selector?: string;
  text?: string;
  timeoutMs?: number;
};

type ActiveSession = {
  context: BrowserContext;
  profilePath: string;
  startedAt: Date;
  lastCheckedAt?: Date;
  lastUrl?: string;
};

export type BrowserSessionStatus = {
  projectCode: string;
  systemCode: string;
  profilePath: string;
  active: boolean;
  profileExists: boolean;
  loginState: "not_configured" | "unknown" | "valid" | "invalid";
  lastUrl?: string;
  startedAt?: string;
  lastCheckedAt?: string;
  message?: string;
};

@Injectable()
export class BrowserSessionService implements OnModuleDestroy {
  private readonly activeSessions = new Map<string, ActiveSession>();

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.activeSessions.values()).map((session) =>
        session.context.close().catch(() => undefined),
      ),
    );
    this.activeSessions.clear();
  }

  async openInteractiveSession(project: ProjectEntity, system: ExternalSystemEntity) {
    const sessionKey = this.sessionKey(system);
    const active = this.activeSessions.get(sessionKey);
    if (active) {
      const page = active.context.pages()[0] || await active.context.newPage();
      active.lastUrl = page.url();
      return this.toStatus(project, system, "unknown", undefined, active);
    }

    const profilePath = this.resolveProfilePath(project, system);
    await mkdir(profilePath, { recursive: true });
    const context = await chromium.launchPersistentContext(profilePath, {
      ...this.launchOptions(false),
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
    });
    const session: ActiveSession = {
      context,
      profilePath,
      startedAt: new Date(),
    };
    this.activeSessions.set(sessionKey, session);
    context.on("close", () => this.activeSessions.delete(sessionKey));

    const page = context.pages()[0] || await context.newPage();
    const entryUrl = system.loginUrl || system.baseUrl;
    if (entryUrl) {
      await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => undefined);
      session.lastUrl = page.url();
    }

    return this.toStatus(project, system, "unknown", undefined, session);
  }

  async getSessionStatus(project: ProjectEntity, system: ExternalSystemEntity): Promise<BrowserSessionStatus> {
    const active = this.activeSessions.get(this.sessionKey(system));
    return this.toStatus(project, system, this.hasLoginCheck(system) ? "unknown" : "not_configured", undefined, active);
  }

  async refreshSession(project: ProjectEntity, system: ExternalSystemEntity): Promise<BrowserSessionStatus> {
    const active = this.activeSessions.get(this.sessionKey(system));
    if (!this.hasLoginCheck(system)) {
      return this.toStatus(project, system, "not_configured", "未配置登录检查规则", active);
    }

    let context = active?.context;
    let shouldClose = false;
    const profilePath = this.resolveProfilePath(project, system);
    if (!context) {
      await mkdir(profilePath, { recursive: true });
      context = await chromium.launchPersistentContext(profilePath, {
        ...this.launchOptions(true),
        viewport: { width: 1440, height: 900 },
        acceptDownloads: true,
      });
      shouldClose = true;
    }

    const session = active || {
      context,
      profilePath,
      startedAt: new Date(),
    };
    const page = context.pages()[0] || await context.newPage();
    try {
      await this.navigateForValidation(page, system);
      await this.validateLoginState(page, system);
      session.lastCheckedAt = new Date();
      session.lastUrl = page.url();
      return this.toStatus(project, system, "valid", undefined, active);
    } catch (error) {
      session.lastCheckedAt = new Date();
      session.lastUrl = page.url();
      return this.toStatus(project, system, "invalid", this.errorMessage(error), active);
    } finally {
      if (!active) await page.close().catch(() => undefined);
      if (shouldClose) await context.close().catch(() => undefined);
    }
  }

  async clearSession(project: ProjectEntity, system: ExternalSystemEntity): Promise<BrowserSessionStatus> {
    const sessionKey = this.sessionKey(system);
    const active = this.activeSessions.get(sessionKey);
    if (active) {
      await active.context.close().catch(() => undefined);
      this.activeSessions.delete(sessionKey);
    }

    const profilePath = this.resolveProfilePath(project, system);
    await rm(profilePath, { recursive: true, force: true });
    return this.toStatus(project, system, this.hasLoginCheck(system) ? "unknown" : "not_configured");
  }

  async withAutomationPage<T>(
    project: ProjectEntity,
    system: ExternalSystemEntity,
    fn: (page: Page) => Promise<T>,
  ) {
    const active = this.activeSessions.get(this.sessionKey(system));
    let context = active?.context;
    let shouldClose = false;
    const profilePath = this.resolveProfilePath(project, system);

    if (!context) {
      await mkdir(profilePath, { recursive: true });
      context = await chromium.launchPersistentContext(profilePath, {
        ...this.launchOptions(this.automationHeadless()),
        viewport: { width: 1440, height: 900 },
        acceptDownloads: true,
      });
      shouldClose = true;
    }

    const page = await context.newPage();
    try {
      if (this.hasLoginCheck(system)) {
        await this.navigateForValidation(page, system);
        await this.validateLoginState(page, system);
      }
      return await fn(page);
    } finally {
      await page.close().catch(() => undefined);
      if (shouldClose) {
        await context.close().catch(() => undefined);
      }
    }
  }

  async validateLoginState(page: Page, system: ExternalSystemEntity) {
    const rule = this.loginCheck(system);
    if (!rule) return;

    const timeout = rule.timeoutMs || 5000;
    if (rule.urlPattern) {
      const pattern = new RegExp(rule.urlPattern);
      if (!pattern.test(page.url())) {
        throw new DomainError("LOGIN_REQUIRED", "浏览器会话未通过 URL 登录检查", HttpStatus.PRECONDITION_REQUIRED, {
          expected: rule.urlPattern,
          actual: page.url(),
        });
      }
    }

    if (rule.urlIncludes && !page.url().includes(rule.urlIncludes)) {
      throw new DomainError("LOGIN_REQUIRED", "浏览器会话未通过 URL 登录检查", HttpStatus.PRECONDITION_REQUIRED, {
        expected: rule.urlIncludes,
        actual: page.url(),
      });
    }

    if (rule.selector) {
      const locator = page.locator(rule.selector).first();
      try {
        await locator.waitFor({ timeout });
        if (rule.text) {
          const text = (await locator.textContent({ timeout })) || "";
          if (!text.includes(rule.text)) {
            throw new DomainError("LOGIN_REQUIRED", "浏览器会话未通过文本登录检查", HttpStatus.PRECONDITION_REQUIRED, {
              selector: rule.selector,
              expected: rule.text,
            });
          }
        }
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError("LOGIN_REQUIRED", "浏览器会话未通过元素登录检查", HttpStatus.PRECONDITION_REQUIRED, {
          selector: rule.selector,
          timeoutMs: timeout,
        });
      }
    }
  }

  resolveProfilePath(project: ProjectEntity, system: ExternalSystemEntity) {
    const root = resolve(this.config.get<string>("SNAPSHOT_BROWSER_PROFILE_ROOT", "data/browser-profiles"));
    const relativeProfile = this.normalizeRelativeProfile(system.browserProfileId || `${project.code}/${system.code}`);
    const profilePath = resolve(root, relativeProfile);
    const pathFromRoot = relative(root, profilePath);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      throw new DomainError("CAPTURE_FAILED", "Browser profile path escapes profile root", HttpStatus.BAD_REQUEST);
    }
    return profilePath;
  }

  private async toStatus(
    project: ProjectEntity,
    system: ExternalSystemEntity,
    loginState: BrowserSessionStatus["loginState"],
    message?: string,
    active?: ActiveSession,
  ): Promise<BrowserSessionStatus> {
    const profilePath = this.resolveProfilePath(project, system);
    const profileExists = await this.pathExists(profilePath);
    return {
      projectCode: project.code,
      systemCode: system.code,
      profilePath,
      active: !!active,
      profileExists,
      loginState,
      lastUrl: active?.lastUrl,
      startedAt: active?.startedAt.toISOString(),
      lastCheckedAt: active?.lastCheckedAt?.toISOString(),
      message,
    };
  }

  private async navigateForValidation(page: Page, system: ExternalSystemEntity) {
    const targetUrl = system.baseUrl || system.loginUrl;
    if (targetUrl && page.url() === "about:blank") {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    }
  }

  private loginCheck(system: ExternalSystemEntity): LoginCheckRule | undefined {
    const policy = system.sessionPolicy || {};
    const loginCheck = (policy.loginCheck || policy.login_check) as LoginCheckRule | undefined;
    if (!loginCheck) return undefined;
    if (!loginCheck.required && !loginCheck.urlPattern && !loginCheck.urlIncludes && !loginCheck.selector) {
      return undefined;
    }
    return loginCheck;
  }

  private hasLoginCheck(system: ExternalSystemEntity) {
    return !!this.loginCheck(system);
  }

  private launchOptions(headless: boolean) {
    const executablePath = this.config.get<string>("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH");
    return {
      headless,
      ...(executablePath ? { executablePath } : {}),
    };
  }

  private automationHeadless() {
    return this.config.get<string>("SNAPSHOT_BROWSER_HEADLESS", "true") !== "false";
  }

  private normalizeRelativeProfile(profile: string) {
    return profile
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/[^A-Za-z0-9_.-]/g, "_"))
      .join("/");
  }

  private sessionKey(system: ExternalSystemEntity) {
    return system.id;
  }

  private async pathExists(path: string) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
