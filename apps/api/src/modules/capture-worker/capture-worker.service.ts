import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { type Page } from "playwright";
import { setTimeout as sleep } from "timers/promises";
import { DataSource, In, Repository } from "typeorm";
import { DomainError } from "../../common/errors/domain-error";
import { AssetEntity } from "../../database/entities/asset.entity";
import { AssetSequenceEntity } from "../../database/entities/asset-sequence.entity";
import { CapturePlanEntity } from "../../database/entities/capture-plan.entity";
import { CaptureRunEntity } from "../../database/entities/capture-run.entity";
import { ExternalSystemEntity } from "../../database/entities/external-system.entity";
import { ProjectEntity } from "../../database/entities/project.entity";
import { RunStepEntity } from "../../database/entities/run-step.entity";
import { BrowserSessionService } from "./browser-session.service";

type CaptureStep = {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  selector?: string;
  value?: unknown;
  valueLiteral?: unknown;
  valueRef?: string;
  parameter?: string;
  timeoutMs?: number;
  fullPage?: boolean;
  title?: string;
  outputRef?: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  retry?: {
    attempts?: number;
    delayMs?: number;
    backoffMs?: number;
  };
  retryAttempts?: number;
  retryDelayMs?: number;
};

type TablePayload = {
  columns: string[];
  rows: string[][];
};

@Injectable()
export class CaptureWorkerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly browserSessions: BrowserSessionService,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ExternalSystemEntity)
    private readonly systems: Repository<ExternalSystemEntity>,
    @InjectRepository(CapturePlanEntity)
    private readonly plans: Repository<CapturePlanEntity>,
    @InjectRepository(CaptureRunEntity)
    private readonly runs: Repository<CaptureRunEntity>,
    @InjectRepository(AssetEntity)
    private readonly assets: Repository<AssetEntity>,
    @InjectRepository(RunStepEntity)
    private readonly runSteps: Repository<RunStepEntity>,
    @InjectRepository(AssetSequenceEntity)
    private readonly assetSequences: Repository<AssetSequenceEntity>,
  ) {}

  async executeRun(runId: string) {
    const run = await this.runs.findOne({ where: { id: runId } });
    if (!run) {
      throw new DomainError("CAPTURE_FAILED", `Capture run not found: ${runId}`, HttpStatus.NOT_FOUND);
    }

    const project = await this.projects.findOne({ where: { id: run.projectId } });
    if (!project) {
      throw new DomainError("PROJECT_NOT_FOUND", `Project not found: ${run.projectId}`, HttpStatus.NOT_FOUND);
    }

    const requestedPlanIds = run.requestedPlanIds || [];
    const planRecords = requestedPlanIds.length > 0
      ? await this.plans.find({ where: { id: In(requestedPlanIds) } })
      : [];
    const planMap = new Map(planRecords.map((plan) => [plan.id, plan]));
    const plans = requestedPlanIds.map((id) => planMap.get(id)).filter((plan): plan is CapturePlanEntity => !!plan);
    const steps = await this.runSteps.find({
      where: { runId },
      order: { sequence: "ASC", createdAt: "ASC" },
    });

    await this.markRunRunning(runId);

    try {
      for (const plan of plans) {
        const system = await this.systems.findOne({ where: { id: plan.externalSystemId } });
        if (!system) {
          throw new DomainError(
            "SYSTEM_NOT_FOUND",
            `External system not found: ${plan.externalSystemId}`,
            HttpStatus.NOT_FOUND,
          );
        }

        await this.browserSessions.withAutomationPage(project, system, async (page) => {
          await this.executePlan(project, system, plan, run, steps, page);
        });
      }

      return this.markRunSucceeded(runId);
    } catch (error) {
      return this.markRunFailed(runId, error);
    }
  }

  private async executePlan(
    project: ProjectEntity,
    system: ExternalSystemEntity,
    plan: CapturePlanEntity,
    run: CaptureRunEntity,
    runSteps: RunStepEntity[],
    page: Page,
  ) {
    const planSteps = (plan.steps || []) as CaptureStep[];
    for (let index = 0; index < planSteps.length; index += 1) {
      const step = planSteps[index];
      const stepId = String(step.id || `${plan.code}-step-${index + 1}`);
      const stepRecord = runSteps.find((item) => item.planId === plan.id && item.stepId === stepId);
      if (!stepRecord) continue;

      await this.markStepRunning(stepRecord.id);
      const retryPolicy = this.resolveRetryPolicy(step);
      let attempt = 0;
      try {
        while (true) {
          try {
            attempt += 1;
            await this.executeStep(project, system, plan, run, stepRecord, step, page);
            await this.markStepSucceeded(stepRecord.id, {
              url: page.url(),
              attempts: attempt,
              retryPolicy,
            });
            break;
          } catch (error) {
            if (attempt > retryPolicy.attempts) throw error;
            await sleep(retryPolicy.delayMs + Math.max(0, attempt - 1) * retryPolicy.backoffMs);
          }
        }
      } catch (error) {
        const diagnostics = await this.collectFailureDiagnostics(project, plan, run, stepRecord, step, page, error, {
          attempts: attempt,
          retryPolicy,
        });
        await this.markStepFailed(stepRecord.id, error, diagnostics);
        throw error;
      }
    }
  }

  private async executeStep(
    project: ProjectEntity,
    system: ExternalSystemEntity,
    plan: CapturePlanEntity,
    run: CaptureRunEntity,
    stepRecord: RunStepEntity,
    step: CaptureStep,
    page: Page,
  ) {
    switch (step.type) {
      case "goto":
        await page.goto(this.resolveUrl(system.baseUrl, step.url), {
          waitUntil: step.waitUntil || "domcontentloaded",
          timeout: step.timeoutMs || 30000,
        });
        return;
      case "fill":
        await page.fill(this.requireSelector(step), this.resolveInputValue(step, run.inputSnapshot), {
          timeout: step.timeoutMs || 30000,
        });
        return;
      case "selectOption":
        await page.selectOption(this.requireSelector(step), this.resolveInputValue(step, run.inputSnapshot), {
          timeout: step.timeoutMs || 30000,
        });
        return;
      case "click":
        await page.click(this.requireSelector(step), { timeout: step.timeoutMs || 30000 });
        return;
      case "waitForSelector":
        await page.waitForSelector(this.requireSelector(step), { timeout: step.timeoutMs || 30000 });
        return;
      case "screenshotPage":
        await this.saveScreenshotAsset(project, plan, run, stepRecord, step, page, await page.screenshot({
          fullPage: step.fullPage ?? true,
          type: "png",
        }));
        return;
      case "screenshotElement": {
        const locator = page.locator(this.requireSelector(step)).first();
        await locator.waitFor({ timeout: step.timeoutMs || 30000 });
        await this.saveScreenshotAsset(project, plan, run, stepRecord, step, page, await locator.screenshot({
          type: "png",
        }));
        return;
      }
      case "extractTable":
        await this.saveTableAssets(project, plan, run, stepRecord, step, page);
        return;
      default:
        throw new DomainError(
          "CAPTURE_FAILED",
          `Unsupported capture step type: ${step.type || "unknown"}`,
          HttpStatus.BAD_REQUEST,
          { stepId: stepRecord.stepId, supportedTypes: this.supportedStepTypes() },
        );
    }
  }

  private async saveScreenshotAsset(
    project: ProjectEntity,
    plan: CapturePlanEntity,
    run: CaptureRunEntity,
    stepRecord: RunStepEntity,
    step: CaptureStep,
    page: Page,
    content: Buffer,
  ) {
    const fileName = `${stepRecord.stepId}.png`;
    const relativePath = this.assetRelativePath(run.id, fileName);
    const absolutePath = await this.writeAssetFile(project.assetRoot, relativePath, content);
    const assetCode = await this.allocateAssetCode(project.id, project.code, "image");

    await this.assets.save(
      this.assets.create({
        assetCode,
        projectId: project.id,
        runId: run.id,
        planId: plan.id,
        stepId: stepRecord.stepId,
        type: "image",
        title: step.title || stepRecord.stepName || stepRecord.stepId,
        filePath: absolutePath,
        contentType: "image/png",
        contentHash: this.hashContent(content),
        sourceUrl: page.url(),
        selectorSnapshot: step.selector ? { selector: step.selector } : {},
        parameterSnapshot: this.maskParameterSnapshot(this.extractParameterSnapshot(step, run.inputSnapshot), plan.inputSchema),
        metadata: { outputRef: step.outputRef || "", relativePath },
      }),
    );
  }

  private async saveTableAssets(
    project: ProjectEntity,
    plan: CapturePlanEntity,
    run: CaptureRunEntity,
    stepRecord: RunStepEntity,
    step: CaptureStep,
    page: Page,
  ) {
    const selector = this.requireSelector(step);
    await page.waitForSelector(selector, { timeout: step.timeoutMs || 30000 });
    const table = await page.$eval(selector, (element) => {
      const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th,td")).map((cell) => (cell.textContent || "").trim()),
      );
      const columns = rows.length > 0 ? rows[0] : [];
      return { columns, rows: rows.slice(1) };
    }) as TablePayload;

    const jsonContent = Buffer.from(JSON.stringify(table, null, 2), "utf8");
    const csvContent = Buffer.from(this.toCsv(table), "utf8");
    await this.saveStructuredAsset(project, plan, run, stepRecord, step, page, jsonContent, "table", "json");
    await this.saveStructuredAsset(project, plan, run, stepRecord, step, page, csvContent, "table", "csv");
  }

  private async saveStructuredAsset(
    project: ProjectEntity,
    plan: CapturePlanEntity,
    run: CaptureRunEntity,
    stepRecord: RunStepEntity,
    step: CaptureStep,
    page: Page,
    content: Buffer,
    type: string,
    extension: "json" | "csv",
  ) {
    const fileName = `${stepRecord.stepId}.${extension}`;
    const relativePath = this.assetRelativePath(run.id, fileName);
    const absolutePath = await this.writeAssetFile(project.assetRoot, relativePath, content);
    const assetCode = await this.allocateAssetCode(project.id, project.code, type);

    await this.assets.save(
      this.assets.create({
        assetCode,
        projectId: project.id,
        runId: run.id,
        planId: plan.id,
        stepId: stepRecord.stepId,
        type,
        title: step.title || stepRecord.stepName || stepRecord.stepId,
        filePath: absolutePath,
        contentType: extension === "json" ? "application/json" : "text/csv",
        contentHash: this.hashContent(content),
        sourceUrl: page.url(),
        selectorSnapshot: step.selector ? { selector: step.selector } : {},
        parameterSnapshot: this.maskParameterSnapshot(this.extractParameterSnapshot(step, run.inputSnapshot), plan.inputSchema),
        metadata: { outputRef: step.outputRef || "", format: extension, relativePath },
      }),
    );
  }

  private async collectFailureDiagnostics(
    project: ProjectEntity,
    plan: CapturePlanEntity,
    run: CaptureRunEntity,
    stepRecord: RunStepEntity,
    step: CaptureStep,
    page: Page,
    error: unknown,
    diagnostics: Record<string, unknown>,
  ) {
    const normalized = this.normalizeError(error);
    const result: Record<string, unknown> = {
      ...diagnostics,
      url: page.url(),
      errorCode: normalized.code,
      errorMessage: this.maskSensitiveText(normalized.message, run.inputSnapshot, plan.inputSchema),
    };

    if (step.selector) {
      result.selector = step.selector;
      result.selectorDiagnostics = await this.selectorDiagnostics(page, step.selector);
    }

    const screenshot = await this.saveFailureScreenshotAsset(project, plan, run, stepRecord, step, page);
    if (screenshot) {
      result.failureScreenshot = screenshot;
    }

    return result;
  }

  private async selectorDiagnostics(page: Page, selector: string) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      const samples = await locator.evaluateAll((elements) =>
        elements.slice(0, 5).map((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return {
            tagName: element.tagName.toLowerCase(),
            text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none",
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        }),
      );
      return { count, samples };
    } catch (error) {
      return {
        count: 0,
        selectorError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async saveFailureScreenshotAsset(
    project: ProjectEntity,
    plan: CapturePlanEntity,
    run: CaptureRunEntity,
    stepRecord: RunStepEntity,
    step: CaptureStep,
    page: Page,
  ) {
    try {
      const content = await page.screenshot({ fullPage: true, type: "png" });
      const fileName = `${stepRecord.stepId}-failure.png`;
      const relativePath = this.assetRelativePath(run.id, fileName);
      const absolutePath = await this.writeAssetFile(project.assetRoot, relativePath, content);
      const assetCode = await this.allocateAssetCode(project.id, project.code, "image");
      await this.assets.save(
        this.assets.create({
          assetCode,
          projectId: project.id,
          runId: run.id,
          planId: plan.id,
          stepId: stepRecord.stepId,
          type: "image",
          title: `Failure ${step.title || stepRecord.stepName || stepRecord.stepId}`,
          filePath: absolutePath,
          contentType: "image/png",
          contentHash: this.hashContent(content),
          sourceUrl: page.url(),
          selectorSnapshot: step.selector ? { selector: step.selector } : {},
          parameterSnapshot: this.maskParameterSnapshot(this.extractParameterSnapshot(step, run.inputSnapshot), plan.inputSchema),
          metadata: {
            diagnostic: true,
            reason: "step_failure",
            relativePath,
          },
        }),
      );
      return { assetCode, filePath: absolutePath, relativePath };
    } catch (error) {
      return {
        failed: true,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async markRunRunning(runId: string) {
    await this.runs.update(runId, {
      status: "running",
      startedAt: new Date(),
      errorCode: "",
      errorMessage: "",
    });
  }

  private async markRunSucceeded(runId: string) {
    await this.runs.update(runId, {
      status: "succeeded",
      finishedAt: new Date(),
      errorCode: "",
      errorMessage: "",
    });
    return this.runs.findOneByOrFail({ id: runId });
  }

  private async markRunFailed(runId: string, error: unknown) {
    const run = await this.runs.findOneByOrFail({ id: runId });
    const normalized = this.normalizeError(error);
    await this.runs.update(runId, {
      status: "failed",
      finishedAt: new Date(),
      errorCode: normalized.code,
      errorMessage: this.maskSensitiveText(normalized.message, run.inputSnapshot),
    });
    return this.runs.findOneByOrFail({ id: runId });
  }

  private async markStepRunning(stepId: string) {
    await this.runSteps.update(stepId, {
      status: "running",
      startedAt: new Date(),
      errorCode: "",
      message: "",
    });
  }

  private async markStepSucceeded(stepId: string, diagnostics: Record<string, unknown>) {
    const step = await this.runSteps.findOneByOrFail({ id: stepId });
    step.status = "succeeded";
    step.finishedAt = new Date();
    step.diagnostics = diagnostics;
    await this.runSteps.save(step);
  }

  private async markStepFailed(stepId: string, error: unknown, diagnostics: Record<string, unknown>) {
    const normalized = this.normalizeError(error);
    const step = await this.runSteps.findOneByOrFail({ id: stepId });
    step.status = "failed";
    step.finishedAt = new Date();
    step.errorCode = normalized.code;
    step.message = this.maskSensitiveText(normalized.message);
    step.diagnostics = diagnostics;
    await this.runSteps.save(step);
  }

  private async allocateAssetCode(projectId: string, projectCode: string, assetType: string, date = new Date()) {
    const dateKey = date.toISOString().slice(0, 10).replace(/-/g, "");
    return this.dataSource.transaction(async (manager) => {
      const sequenceRepo = manager.getRepository(AssetSequenceEntity);
      let sequence = await sequenceRepo.findOne({ where: { projectId, dateKey, assetType } });
      if (!sequence) {
        sequence = sequenceRepo.create({ projectId, dateKey, assetType, nextValue: 1 });
      }
      const value = sequence.nextValue;
      sequence.nextValue += 1;
      await sequenceRepo.save(sequence);
      return `${projectCode}-${assetType.toUpperCase()}-${dateKey}-${String(value).padStart(4, "0")}`;
    });
  }

  private async writeAssetFile(assetRoot: string, relativePath: string, content: Buffer) {
    const root = resolve(assetRoot || "data/assets");
    const absolutePath = resolve(root, relativePath);
    const pathFromRoot = relative(root, absolutePath);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      throw new DomainError("ASSET_WRITE_FAILED", "Resolved asset path escapes asset root", HttpStatus.BAD_REQUEST);
    }
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
    return absolutePath;
  }

  private assetRelativePath(runId: string, fileName: string) {
    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return join(dateKey, runId, fileName);
  }

  private resolveUrl(baseUrl: string, url?: string) {
    if (!url) return baseUrl;
    if (/^https?:\/\//i.test(url) || url.startsWith("file:")) return url;
    return new URL(url, baseUrl).toString();
  }

  private resolveInputValue(step: CaptureStep, parameters: Record<string, unknown>) {
    const rawValue = step.valueRef || step.parameter
      ? parameters[String(step.valueRef || step.parameter)]
      : step.valueLiteral ?? step.value ?? "";
    if (typeof rawValue !== "string") return String(rawValue ?? "");
    return rawValue.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_, key: string) =>
      String(parameters[key] ?? ""),
    );
  }

  private requireSelector(step: CaptureStep) {
    if (!step.selector) {
      throw new DomainError("CAPTURE_FAILED", `Step requires selector: ${step.type}`, HttpStatus.BAD_REQUEST);
    }
    return step.selector;
  }

  private extractParameterSnapshot(step: CaptureStep, parameters: Record<string, unknown>) {
    const key = step.valueRef || step.parameter;
    if (!key) return {};
    return { [key]: parameters[key] };
  }

  private maskParameterSnapshot(snapshot: Record<string, unknown>, inputSchema: unknown) {
    const secureKeys = this.secureParameterNames(inputSchema);
    return Object.fromEntries(
      Object.entries(snapshot).map(([key, value]) => [
        key,
        secureKeys.has(key) || this.isSensitiveKey(key) ? "***" : value,
      ]),
    );
  }

  private maskSensitiveText(text: string, parameters?: Record<string, unknown>, inputSchema?: unknown) {
    let masked = text;
    const secureKeys = this.secureParameterNames(inputSchema);
    for (const [key, value] of Object.entries(parameters || {})) {
      if (!this.isSensitiveKey(key) && !secureKeys.has(key)) continue;
      if (typeof value !== "string" || !value) continue;
      masked = masked.split(value).join("***");
    }
    return masked;
  }

  private secureParameterNames(inputSchema: unknown) {
    const secureKeys = new Set<string>();
    if (!Array.isArray(inputSchema)) return secureKeys;
    for (const item of inputSchema) {
      const parameter = item as { name?: unknown; secure?: unknown; type?: unknown };
      if (
        typeof parameter.name === "string"
        && (parameter.secure === true || String(parameter.type || "").toLowerCase() === "password")
      ) {
        secureKeys.add(parameter.name);
      }
    }
    return secureKeys;
  }

  private isSensitiveKey(key: string) {
    return /password|passwd|pwd|token|secret|credential|api[_-]?key/i.test(key);
  }

  private resolveRetryPolicy(step: CaptureStep) {
    const attempts = Number(step.retry?.attempts ?? step.retryAttempts ?? 0);
    const delayMs = Number(step.retry?.delayMs ?? step.retryDelayMs ?? 250);
    const backoffMs = Number(step.retry?.backoffMs ?? 0);
    return {
      attempts: Number.isFinite(attempts) ? Math.max(0, Math.min(5, Math.floor(attempts))) : 0,
      delayMs: Number.isFinite(delayMs) ? Math.max(0, Math.min(10000, Math.floor(delayMs))) : 250,
      backoffMs: Number.isFinite(backoffMs) ? Math.max(0, Math.min(10000, Math.floor(backoffMs))) : 0,
    };
  }

  private hashContent(content: Buffer) {
    return createHash("sha256").update(content).digest("hex");
  }

  private toCsv(table: TablePayload) {
    return [table.columns, ...table.rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
  }

  private normalizeError(error: unknown) {
    if (error instanceof DomainError) {
      const response = error.getResponse();
      if (typeof response === "object" && response && "code" in response && "message" in response) {
        return {
          code: String((response as { code: unknown }).code),
          message: String((response as { message: unknown }).message),
        };
      }
    }
    if (error instanceof Error) {
      return { code: "CAPTURE_FAILED", message: error.message };
    }
    return { code: "CAPTURE_FAILED", message: String(error) };
  }

  private supportedStepTypes() {
    return [
      "goto",
      "fill",
      "selectOption",
      "click",
      "waitForSelector",
      "screenshotPage",
      "screenshotElement",
      "extractTable",
    ];
  }
}
