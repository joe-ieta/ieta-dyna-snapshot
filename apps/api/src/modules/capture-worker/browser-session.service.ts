import { HttpStatus, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
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
  domMarking?: DomMarkingSession;
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

type SelectorCandidate = {
  type: "css" | "xpath" | "role" | "text" | "testId" | "relative";
  value: string;
  priority: number;
  stabilityScore?: number;
};

type DomElementKind =
  | "container"
  | "image"
  | "table"
  | "input"
  | "select"
  | "button"
  | "link"
  | "text"
  | "unknown";

type DomElementRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DomElementAttributes = {
  id?: string;
  name?: string;
  type?: string;
  role?: string;
  placeholder?: string;
  ariaLabel?: string;
  title?: string;
  testId?: string;
  className?: string;
  href?: string;
  valuePreview?: string;
};

type CaptureStepSuggestion = {
  id: string;
  name: string;
  type: string;
  selector?: string;
  selectorCandidates?: SelectorCandidate[];
  valueRef?: string;
  parameter?: string;
  timeoutMs?: number;
  fullPage?: boolean;
  outputRef?: string;
  metadata?: Record<string, unknown>;
};

type InputParameterSuggestion = {
  name: string;
  label: string;
  type: "string" | "password" | "number" | "date" | "boolean" | "select";
  required: boolean;
  secure: boolean;
  defaultValue?: unknown;
  allowedValues?: Array<{ label: string; value: string }>;
};

type DomMarkerPayload = {
  url?: string;
  pageTitle?: string;
  tagName: string;
  kind: DomElementKind;
  selector?: string;
  selectorCandidates?: SelectorCandidate[];
  label?: string;
  text?: string;
  attributes?: DomElementAttributes;
  rect?: DomElementRect;
  metadata?: Record<string, unknown>;
};

export type DomMarkingSelection = {
  id: string;
  sequence: number;
  url: string;
  pageTitle: string;
  capturedAt: string;
  tagName: string;
  kind: DomElementKind;
  selector: string;
  selectorCandidates: SelectorCandidate[];
  label?: string;
  text?: string;
  attributes: DomElementAttributes;
  rect: DomElementRect;
  recommendedSteps: CaptureStepSuggestion[];
  recommendedParameters: InputParameterSuggestion[];
  metadata?: Record<string, unknown>;
};

export type DomMarkingStatus = {
  projectCode: string;
  systemCode: string;
  active: boolean;
  profilePath: string;
  currentUrl?: string;
  startedAt?: string;
  stoppedAt?: string;
  lastSelectionAt?: string;
  selectionCount: number;
  selections: DomMarkingSelection[];
};

export type DomInputScanResult = {
  projectCode: string;
  systemCode: string;
  url: string;
  scannedAt: string;
  selections: DomMarkingSelection[];
  parameters: InputParameterSuggestion[];
  fillSteps: CaptureStepSuggestion[];
};

type DomMarkingSession = {
  active: boolean;
  selections: DomMarkingSelection[];
  nextSequence: number;
  startedAt?: Date;
  stoppedAt?: Date;
  lastSelectionAt?: Date;
  bindingInstalled?: boolean;
  initScriptInstalled?: boolean;
  pageListenerInstalled?: boolean;
};

function installDomMarkerScript() {
  const win = window as typeof window & {
    __snapshotDomMarker?: {
      installed: boolean;
      setActive: (active: boolean) => void;
      describeElement: (element: Element) => DomMarkerPayload;
      scanInputs: () => DomMarkerPayload[];
    };
    __snapshotDomMarkerSelect?: (payload: DomMarkerPayload) => Promise<unknown>;
  };

  if (win.__snapshotDomMarker?.installed) return;

  const state: { active: boolean; overlay?: HTMLDivElement } = { active: false };
  const maxTextLength = 180;
  const markerColor = "#2563eb";

  const compactText = (value?: string | null) => (value || "").replace(/\s+/g, " ").trim().slice(0, maxTextLength);
  const cssEscape = (value: string) => {
    if (win.CSS?.escape) return win.CSS.escape(value);
    return value.replace(/[^A-Za-z0-9_-]/g, (char) => `\\${char}`);
  };
  const attrEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const isVisible = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const style = win.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const unique = (selector: string) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };
  const pushCandidate = (
    candidates: SelectorCandidate[],
    candidate: SelectorCandidate | undefined,
  ) => {
    if (!candidate?.value) return;
    if (candidates.some((item) => item.type === candidate.type && item.value === candidate.value)) return;
    candidates.push(candidate);
  };
  const cssPath = (element: Element) => {
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      if ((current as HTMLElement).id) {
        parts.unshift(`${tag}#${cssEscape((current as HTMLElement).id)}`);
        break;
      }
      const parent: Element | null = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const currentTag = current.tagName;
      const siblings = Array.from(parent.children).filter((item): item is Element =>
        item instanceof Element && item.tagName === currentTag,
      );
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.length > 0 ? parts.join(" > ") : "body";
  };
  const nearestLabel = (element: Element) => {
    const html = element as HTMLInputElement;
    if (html.id) {
      const explicit = document.querySelector(`label[for="${attrEscape(html.id)}"]`);
      const text = compactText(explicit?.textContent);
      if (text) return text;
    }
    const wrapped = element.closest("label");
    const wrappedText = compactText(wrapped?.textContent);
    if (wrappedText) return wrappedText;
    const aria = element.getAttribute("aria-label");
    if (aria) return compactText(aria);
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => compactText(document.getElementById(id)?.textContent))
        .filter(Boolean)
        .join(" ");
      if (text) return compactText(text);
    }
    return "";
  };
  const elementKind = (element: Element): DomElementKind => {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role") || "";
    if (tag === "input" || tag === "textarea" || element.getAttribute("contenteditable") === "true") return "input";
    if (tag === "select") return "select";
    if (tag === "button") return "button";
    if (tag === "a") return "link";
    if (tag === "img") return "image";
    if (tag === "table" || role === "table" || role === "grid") return "table";
    const text = compactText(element.textContent);
    return text ? "text" : "container";
  };
  const selectorCandidates = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    const html = element as HTMLElement;
    const candidates: SelectorCandidate[] = [];
    const testId = html.dataset?.testid || html.dataset?.testId || html.dataset?.test || html.dataset?.qa;
    if (testId) {
      pushCandidate(candidates, {
        type: "testId",
        value: `[data-testid="${attrEscape(testId)}"]`,
        priority: 100,
        stabilityScore: unique(`[data-testid="${attrEscape(testId)}"]`) ? 0.98 : 0.86,
      });
    }
    if (html.id) {
      const selector = `#${cssEscape(html.id)}`;
      pushCandidate(candidates, {
        type: "css",
        value: selector,
        priority: 90,
        stabilityScore: unique(selector) ? 0.95 : 0.78,
      });
    }
    const name = element.getAttribute("name");
    if (name) {
      const selector = `${tag}[name="${attrEscape(name)}"]`;
      pushCandidate(candidates, {
        type: "css",
        value: selector,
        priority: 80,
        stabilityScore: unique(selector) ? 0.9 : 0.72,
      });
    }
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      const selector = `${tag}[aria-label="${attrEscape(ariaLabel)}"]`;
      pushCandidate(candidates, {
        type: "css",
        value: selector,
        priority: 76,
        stabilityScore: unique(selector) ? 0.88 : 0.68,
      });
      pushCandidate(candidates, {
        type: "role",
        value: `${element.getAttribute("role") || tag}[name="${ariaLabel}"]`,
        priority: 74,
        stabilityScore: 0.72,
      });
    }
    const text = compactText(element.textContent);
    if (text && text.length <= 80) {
      pushCandidate(candidates, {
        type: "text",
        value: text,
        priority: 55,
        stabilityScore: 0.48,
      });
    }
    const path = cssPath(element);
    pushCandidate(candidates, {
      type: "relative",
      value: path,
      priority: 30,
      stabilityScore: unique(path) ? 0.62 : 0.4,
    });
    return candidates.sort((left, right) => right.priority - left.priority);
  };
  const describeElement = (element: Element): DomMarkerPayload => {
    const rect = element.getBoundingClientRect();
    const input = element as HTMLInputElement;
    const tagName = element.tagName.toLowerCase();
    const attributes: DomElementAttributes = {
      id: input.id || undefined,
      name: input.name || undefined,
      type: input.type || undefined,
      role: element.getAttribute("role") || undefined,
      placeholder: input.placeholder || undefined,
      ariaLabel: element.getAttribute("aria-label") || undefined,
      title: element.getAttribute("title") || undefined,
      testId: (element as HTMLElement).dataset?.testid || (element as HTMLElement).dataset?.testId,
      className: typeof input.className === "string" ? input.className.slice(0, 160) : undefined,
      href: element instanceof HTMLAnchorElement ? element.href : undefined,
      valuePreview: input.type === "password" ? undefined : compactText(input.value),
    };
    const candidates = selectorCandidates(element);
    const label = compactText(
      nearestLabel(element)
        || attributes.placeholder
        || attributes.title
        || attributes.ariaLabel
        || element.textContent,
    );
    const options = tagName === "select"
      ? Array.from((element as HTMLSelectElement).options).slice(0, 80).map((option) => ({
        label: compactText(option.textContent) || option.value,
        value: option.value,
      }))
      : undefined;
    return {
      url: win.location.href,
      pageTitle: document.title || "",
      tagName,
      kind: elementKind(element),
      selector: candidates[0]?.value || cssPath(element),
      selectorCandidates: candidates,
      label: label || undefined,
      text: compactText(element.textContent) || undefined,
      attributes,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      metadata: {
        source: "dom-marker",
        options,
      },
    };
  };
  const ensureOverlay = () => {
    if (state.overlay) return state.overlay;
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.zIndex = "2147483647";
    overlay.style.pointerEvents = "none";
    overlay.style.border = `2px solid ${markerColor}`;
    overlay.style.background = "rgba(37, 99, 235, 0.08)";
    overlay.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.9), 0 8px 24px rgba(37,99,235,0.18)";
    overlay.style.borderRadius = "4px";
    overlay.style.display = "none";
    document.documentElement.appendChild(overlay);
    state.overlay = overlay;
    return overlay;
  };
  const highlight = (element: Element) => {
    if (!state.active || !isVisible(element)) return;
    const rect = element.getBoundingClientRect();
    const overlay = ensureOverlay();
    overlay.style.left = `${Math.max(0, rect.left)}px`;
    overlay.style.top = `${Math.max(0, rect.top)}px`;
    overlay.style.width = `${Math.max(0, rect.width)}px`;
    overlay.style.height = `${Math.max(0, rect.height)}px`;
    overlay.style.display = "block";
  };
  const setActive = (active: boolean) => {
    state.active = active;
    if (!active && state.overlay) state.overlay.style.display = "none";
  };
  const scanInputs = () => Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']"))
    .filter(isVisible)
    .map((element) => describeElement(element));

  document.addEventListener("mouseover", (event) => {
    if (!state.active) return;
    const element = event.target instanceof Element ? event.target : undefined;
    if (element) highlight(element);
  }, true);
  document.addEventListener("click", (event) => {
    if (!state.active) return;
    const element = event.target instanceof Element ? event.target : undefined;
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    highlight(element);
    const payload = describeElement(element);
    void win.__snapshotDomMarkerSelect?.(payload);
  }, true);

  win.__snapshotDomMarker = {
    installed: true,
    setActive,
    describeElement,
    scanInputs,
  };
}

const DOM_MARKER_SCRIPT = `(${installDomMarkerScript.toString()})();`;

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

  async startDomMarking(
    project: ProjectEntity,
    system: ExternalSystemEntity,
    options: { clear?: boolean } = {},
  ): Promise<DomMarkingStatus> {
    await this.openInteractiveSession(project, system);
    const session = this.requireActiveSession(system);
    const marking = this.ensureDomMarking(session);
    if (options.clear) {
      marking.selections = [];
      marking.nextSequence = 1;
      marking.lastSelectionAt = undefined;
    }
    marking.active = true;
    marking.startedAt = new Date();
    marking.stoppedAt = undefined;
    await this.installDomMarker(system, session);
    await this.setDomMarkerActive(session, true);
    return this.toDomMarkingStatus(project, system, session);
  }

  async stopDomMarking(project: ProjectEntity, system: ExternalSystemEntity): Promise<DomMarkingStatus> {
    const session = this.activeSessions.get(this.sessionKey(system));
    if (!session) return this.toDomMarkingStatus(project, system);
    const marking = this.ensureDomMarking(session);
    marking.active = false;
    marking.stoppedAt = new Date();
    await this.setDomMarkerActive(session, false);
    return this.toDomMarkingStatus(project, system, session);
  }

  async getDomMarkingStatus(project: ProjectEntity, system: ExternalSystemEntity): Promise<DomMarkingStatus> {
    return this.toDomMarkingStatus(project, system, this.activeSessions.get(this.sessionKey(system)));
  }

  async clearDomMarkingSelections(project: ProjectEntity, system: ExternalSystemEntity): Promise<DomMarkingStatus> {
    const session = this.activeSessions.get(this.sessionKey(system));
    if (!session) return this.toDomMarkingStatus(project, system);
    const marking = this.ensureDomMarking(session);
    marking.selections = [];
    marking.nextSequence = 1;
    marking.lastSelectionAt = undefined;
    return this.toDomMarkingStatus(project, system, session);
  }

  async scanInputParameters(project: ProjectEntity, system: ExternalSystemEntity): Promise<DomInputScanResult> {
    await this.openInteractiveSession(project, system);
    const session = this.requireActiveSession(system);
    await this.installDomMarker(system, session);
    const page = this.primaryPage(session);
    const payloads = await page.evaluate(() => {
      const marker = (window as typeof window & {
        __snapshotDomMarker?: { scanInputs: () => DomMarkerPayload[] };
      }).__snapshotDomMarker;
      return marker?.scanInputs() || [];
    });
    session.lastUrl = page.url();
    const scannedAt = new Date();
    const selections = payloads.map((payload, index) =>
      this.toDomSelection(system, payload, index + 1, "input-scan", page.url(), scannedAt),
    );
    const parameters = this.uniqueParameters(selections);
    return {
      projectCode: project.code,
      systemCode: system.code,
      url: page.url(),
      scannedAt: scannedAt.toISOString(),
      selections,
      parameters,
      fillSteps: selections.flatMap((selection) =>
        selection.recommendedSteps.filter((step) => step.type === "fill" || step.type === "selectOption"),
      ),
    };
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

  private async installDomMarker(system: ExternalSystemEntity, session: ActiveSession) {
    const marking = this.ensureDomMarking(session);
    if (!marking.bindingInstalled) {
      await session.context.exposeBinding("__snapshotDomMarkerSelect", async (source, payload: DomMarkerPayload) => {
        const activeSession = this.activeSessions.get(this.sessionKey(system));
        if (!activeSession) return { ok: false };
        const activeMarking = this.ensureDomMarking(activeSession);
        if (!activeMarking.active) return { ok: false };

        const page = source.page;
        const sequence = activeMarking.nextSequence;
        activeMarking.nextSequence += 1;
        const capturedAt = new Date();
        const selection = this.toDomSelection(system, payload, sequence, "click", page?.url(), capturedAt);
        activeMarking.selections.push(selection);
        activeMarking.lastSelectionAt = capturedAt;
        activeSession.lastUrl = page?.url() || payload.url;
        return { ok: true, selectionId: selection.id, sequence };
      });
      marking.bindingInstalled = true;
    }

    if (!marking.initScriptInstalled) {
      await session.context.addInitScript(DOM_MARKER_SCRIPT);
      marking.initScriptInstalled = true;
    }

    if (!marking.pageListenerInstalled) {
      session.context.on("page", (page) => {
        page.on("domcontentloaded", () => {
          this.installDomMarkerOnPage(page, marking.active).catch(() => undefined);
        });
      });
      marking.pageListenerInstalled = true;
    }

    await Promise.all(session.context.pages().map((page) => this.installDomMarkerOnPage(page, marking.active)));
  }

  private async setDomMarkerActive(session: ActiveSession, active: boolean) {
    const marking = this.ensureDomMarking(session);
    marking.active = active;
    await Promise.all(session.context.pages().map((page) => this.installDomMarkerOnPage(page, active)));
  }

  private async installDomMarkerOnPage(page: Page, active: boolean) {
    if (page.isClosed()) return;
    await page.evaluate(DOM_MARKER_SCRIPT).catch(() => undefined);
    await page.evaluate((nextActive) => {
      const marker = (window as typeof window & {
        __snapshotDomMarker?: { setActive: (active: boolean) => void };
      }).__snapshotDomMarker;
      marker?.setActive(nextActive);
    }, active).catch(() => undefined);
  }

  private ensureDomMarking(session: ActiveSession): DomMarkingSession {
    session.domMarking ||= {
      active: false,
      selections: [],
      nextSequence: 1,
    };
    return session.domMarking;
  }

  private requireActiveSession(system: ExternalSystemEntity) {
    const session = this.activeSessions.get(this.sessionKey(system));
    if (!session) {
      throw new DomainError(
        "SESSION_EXPIRED",
        "Browser session is not active. Open the system session before DOM marking.",
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
    return session;
  }

  private primaryPage(session: ActiveSession) {
    const page = session.context.pages().find((item) => !item.isClosed());
    if (!page) {
      throw new DomainError("SESSION_EXPIRED", "Browser session has no active page.", HttpStatus.PRECONDITION_REQUIRED);
    }
    return page;
  }

  private toDomSelection(
    system: ExternalSystemEntity,
    payload: DomMarkerPayload,
    sequence: number,
    source: "click" | "input-scan",
    fallbackUrl?: string,
    capturedAt = new Date(),
  ): DomMarkingSelection {
    const selectorCandidates = payload.selectorCandidates || [];
    const selector = payload.selector || selectorCandidates[0]?.value || "body";
    const label = this.compactLabel(payload.label || payload.attributes?.placeholder || payload.text || payload.tagName);
    const selectionId = randomUUID();
    const recommendedParameters = this.recommendedParameters(payload, sequence, label);
    const recommendedSteps = this.recommendedSteps(
      system,
      selectionId,
      sequence,
      payload,
      selector,
      selectorCandidates,
      label,
      recommendedParameters,
    );

    return {
      id: selectionId,
      sequence,
      url: payload.url || fallbackUrl || "",
      pageTitle: payload.pageTitle || "",
      capturedAt: capturedAt.toISOString(),
      tagName: payload.tagName || "unknown",
      kind: payload.kind || "unknown",
      selector,
      selectorCandidates,
      label,
      text: this.compactLabel(payload.text),
      attributes: payload.attributes || {},
      rect: payload.rect || { x: 0, y: 0, width: 0, height: 0 },
      recommendedSteps,
      recommendedParameters,
      metadata: {
        ...(payload.metadata || {}),
        source,
      },
    };
  }

  private recommendedSteps(
    system: ExternalSystemEntity,
    selectionId: string,
    sequence: number,
    payload: DomMarkerPayload,
    selector: string,
    selectorCandidates: SelectorCandidate[],
    label: string | undefined,
    recommendedParameters: InputParameterSuggestion[],
  ): CaptureStepSuggestion[] {
    const suffix = this.slugify(label || payload.attributes?.name || payload.attributes?.id || payload.kind || "element")
      || `element-${sequence}`;
    const stepLabel = label || `${payload.tagName || "element"} ${sequence}`;
    const metadata = { source: "dom-marker", selectionId, systemCode: system.code };
    const steps: CaptureStepSuggestion[] = [];

    if (payload.kind === "input" || payload.kind === "select") {
      const parameter = recommendedParameters[0];
      if (parameter) {
        steps.push({
          id: `set-${parameter.name}`,
          name: `Set ${stepLabel}`,
          type: payload.kind === "select" ? "selectOption" : "fill",
          selector,
          selectorCandidates,
          valueRef: parameter.name,
          parameter: parameter.name,
          timeoutMs: 30000,
          metadata,
        });
      }
      return steps;
    }

    if (payload.kind === "button" || payload.kind === "link") {
      steps.push({
        id: `click-${suffix}`,
        name: `Click ${stepLabel}`,
        type: "click",
        selector,
        selectorCandidates,
        timeoutMs: 30000,
        metadata,
      });
    }

    if (payload.kind === "table") {
      steps.push({
        id: `extract-${suffix}`,
        name: `Extract ${stepLabel}`,
        type: "extractTable",
        selector,
        selectorCandidates,
        timeoutMs: 30000,
        outputRef: suffix,
        metadata,
      });
    }

    steps.push({
      id: `capture-${suffix}`,
      name: `Capture ${stepLabel}`,
      type: "screenshotElement",
      selector,
      selectorCandidates,
      timeoutMs: 30000,
      outputRef: suffix,
      metadata,
    });
    return steps;
  }

  private recommendedParameters(
    payload: DomMarkerPayload,
    sequence: number,
    label?: string,
  ): InputParameterSuggestion[] {
    if (payload.kind !== "input" && payload.kind !== "select") return [];

    const attributes = payload.attributes || {};
    const rawType = (attributes.type || "").toLowerCase();
    const parameterName = this.parameterName(attributes.name || attributes.id || label || `field_${sequence}`, sequence);
    const secure = rawType === "password";
    const allowedValues = Array.isArray(payload.metadata?.options)
      ? (payload.metadata?.options as Array<{ label?: unknown; value?: unknown }>)
        .map((option) => ({
          label: String(option.label ?? option.value ?? ""),
          value: String(option.value ?? option.label ?? ""),
        }))
        .filter((option) => option.value)
      : undefined;

    return [{
      name: parameterName,
      label: label || parameterName,
      type: this.parameterType(payload.kind, rawType),
      required: false,
      secure,
      defaultValue: secure ? undefined : attributes.valuePreview,
      allowedValues: allowedValues && allowedValues.length > 0 ? allowedValues : undefined,
    }];
  }

  private uniqueParameters(selections: DomMarkingSelection[]) {
    const parameters = new Map<string, InputParameterSuggestion>();
    for (const selection of selections) {
      for (const parameter of selection.recommendedParameters) {
        if (!parameters.has(parameter.name)) parameters.set(parameter.name, parameter);
      }
    }
    return Array.from(parameters.values());
  }

  private toDomMarkingStatus(
    project: ProjectEntity,
    system: ExternalSystemEntity,
    session?: ActiveSession,
  ): DomMarkingStatus {
    const marking = session?.domMarking;
    const page = session?.context.pages().find((item) => !item.isClosed());
    return {
      projectCode: project.code,
      systemCode: system.code,
      active: !!marking?.active,
      profilePath: session?.profilePath || this.resolveProfilePath(project, system),
      currentUrl: page?.url() || session?.lastUrl,
      startedAt: marking?.startedAt?.toISOString(),
      stoppedAt: marking?.stoppedAt?.toISOString(),
      lastSelectionAt: marking?.lastSelectionAt?.toISOString(),
      selectionCount: marking?.selections.length || 0,
      selections: marking?.selections || [],
    };
  }

  private parameterType(kind: DomElementKind, rawType: string): InputParameterSuggestion["type"] {
    if (kind === "select") return "select";
    if (rawType === "password") return "password";
    if (rawType === "number" || rawType === "range") return "number";
    if (rawType === "date" || rawType === "datetime-local" || rawType === "month") return "date";
    if (rawType === "checkbox" || rawType === "radio") return "boolean";
    return "string";
  }

  private parameterName(value: string, sequence: number) {
    const normalized = this.slugify(value).replace(/-/g, "_");
    if (/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) return normalized;
    return `field_${sequence}`;
  }

  private slugify(value: string) {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48);
  }

  private compactLabel(value?: string) {
    const normalized = (value || "").replace(/\s+/g, " ").trim();
    return normalized ? normalized.slice(0, 120) : undefined;
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
