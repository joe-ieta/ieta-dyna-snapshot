import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { DomainError } from "../../common/errors/domain-error";
import { AssetEntity } from "../../database/entities/asset.entity";
import { AssetSequenceEntity } from "../../database/entities/asset-sequence.entity";
import { CapturePlanEntity } from "../../database/entities/capture-plan.entity";
import { CaptureRunEntity } from "../../database/entities/capture-run.entity";
import { ExternalSystemEntity } from "../../database/entities/external-system.entity";
import { ProjectEntity } from "../../database/entities/project.entity";
import { RunStepEntity } from "../../database/entities/run-step.entity";
import { CaptureWorkerService } from "../capture-worker/capture-worker.service";
import { CreateCapturePlanDto, UpdateCapturePlanDto } from "./dto/capture-plan.dto";
import { TriggerCaptureRunDto } from "./dto/capture-run.dto";
import { CreateExternalSystemDto, UpdateExternalSystemDto } from "./dto/external-system.dto";
import { CreateProjectDto, UpdateProjectDto } from "./dto/project.dto";

@Injectable()
export class SnapshotService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly captureWorker: CaptureWorkerService,
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

  listProjects() {
    return this.projects.find({ order: { createdAt: "DESC" } });
  }

  async createProject(payload: CreateProjectDto) {
    const existing = await this.projects.findOne({ where: { code: payload.code } });
    if (existing) {
      throw new DomainError(
        "DUPLICATE_CODE",
        `Project code already exists: ${payload.code}`,
        HttpStatus.CONFLICT,
      );
    }

    const project = this.projects.create({
      code: payload.code,
      name: payload.name,
      description: payload.description || "",
      assetRoot: payload.assetRoot || `data/assets/${payload.code}`,
      defaultParameters: payload.defaultParameters || {},
    });
    return this.projects.save(project);
  }

  async getProject(id: string) {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) {
      throw new DomainError("PROJECT_NOT_FOUND", `Project not found: ${id}`, HttpStatus.NOT_FOUND);
    }
    return project;
  }

  async updateProject(id: string, payload: UpdateProjectDto) {
    const project = await this.getProject(id);
    Object.assign(project, payload);
    return this.projects.save(project);
  }

  async findProjectByCode(code: string) {
    const project = await this.projects.findOne({ where: { code } });
    if (!project) {
      throw new DomainError("PROJECT_NOT_FOUND", `Project not found: ${code}`, HttpStatus.NOT_FOUND);
    }
    return project;
  }

  async getProjectInputs(code: string) {
    const project = await this.findProjectByCode(code);
    const plans = await this.plans.find({ where: { projectId: project.id } });
    const merged = new Map<string, unknown>();
    for (const plan of plans) {
      for (const input of plan.inputSchema || []) {
        const item = input as { name?: string };
        if (item.name) merged.set(item.name, input);
      }
    }
    return {
      projectCode: project.code,
      projectDefaults: this.maskParameterMap(project.defaultParameters || {}, plans),
      parameters: Array.from(merged.values()),
      plans: plans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        requiredParameters: (plan.inputSchema || [])
          .filter((item: any) => item.required)
          .map((item: any) => item.name),
      })),
    };
  }

  listSystems(projectId?: string) {
    return this.systems.find({
      where: projectId ? { projectId } : {},
      order: { createdAt: "DESC" },
    });
  }

  async getSystem(id: string) {
    const system = await this.systems.findOne({ where: { id } });
    if (!system) {
      throw new DomainError("SYSTEM_NOT_FOUND", `External system not found: ${id}`, HttpStatus.NOT_FOUND);
    }
    return system;
  }

  async createSystem(payload: CreateExternalSystemDto) {
    const project = await this.getProject(payload.projectId);
    const existing = await this.systems.findOne({
      where: { projectId: payload.projectId, code: payload.code },
    });
    if (existing) {
      throw new DomainError(
        "DUPLICATE_CODE",
        `External system code already exists in project: ${payload.code}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.systems.save(
      this.systems.create({
        ...payload,
        browserProfileId:
          payload.browserProfileId || `${project.code}/${payload.code || "system"}`,
        sessionPolicy: payload.sessionPolicy || {},
      }),
    );
  }

  async updateSystem(id: string, payload: UpdateExternalSystemDto) {
    const system = await this.getSystem(id);
    Object.assign(system, payload);
    return this.systems.save(system);
  }

  listPlans(projectId?: string) {
    return this.plans.find({
      where: projectId ? { projectId } : {},
      order: { createdAt: "DESC" },
    });
  }

  async getPlan(id: string) {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) {
      throw new DomainError("PLAN_NOT_FOUND", `Capture plan not found: ${id}`, HttpStatus.NOT_FOUND);
    }
    return plan;
  }

  async createPlan(payload: CreateCapturePlanDto) {
    await this.getProject(payload.projectId);
    const system = await this.getSystem(payload.externalSystemId);
    if (system.projectId !== payload.projectId) {
      throw new DomainError(
        "SYSTEM_NOT_FOUND",
        "External system does not belong to the target project",
        HttpStatus.BAD_REQUEST,
        { projectId: payload.projectId, externalSystemId: payload.externalSystemId },
      );
    }

    const existing = await this.plans.findOne({
      where: { projectId: payload.projectId, code: payload.code },
    });
    if (existing) {
      throw new DomainError(
        "DUPLICATE_CODE",
        `Capture plan code already exists in project: ${payload.code}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.plans.save(
      this.plans.create({
        ...payload,
        steps: payload.steps || [],
        inputSchema: payload.inputSchema || [],
        enabled: payload.enabled ?? true,
      }),
    );
  }

  async updatePlan(id: string, payload: UpdateCapturePlanDto) {
    const plan = await this.getPlan(id);
    Object.assign(plan, payload);
    return this.plans.save(plan);
  }

  async listRuns(projectId?: string) {
    const runs = await this.runs.find({
      where: projectId ? { projectId } : {},
      order: { createdAt: "DESC" },
    });
    return this.maskRuns(runs);
  }

  async triggerRun(payload: TriggerCaptureRunDto) {
    const project = await this.findProjectByCode(payload.projectCode);
    const plans = await this.plans.find({ where: { projectId: project.id, enabled: true } });
    const requestedCodes = payload.planCodes || [];
    const selectedPlans = requestedCodes.length
      ? plans.filter((plan) => requestedCodes.includes(plan.code))
      : plans;

    const missingPlanCodes = requestedCodes.filter(
      (code) => !selectedPlans.some((plan) => plan.code === code),
    );
    if (missingPlanCodes.length > 0) {
      throw new DomainError(
        "PLAN_NOT_FOUND",
        "One or more requested capture plans were not found",
        HttpStatus.NOT_FOUND,
        { missingPlanCodes },
      );
    }

    if (selectedPlans.length === 0) {
      throw new DomainError(
        "PLAN_NOT_FOUND",
        "No enabled capture plans are available for the project",
        HttpStatus.NOT_FOUND,
        { projectCode: payload.projectCode },
      );
    }

    const run = await this.dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(CaptureRunEntity);
      const stepRepo = manager.getRepository(RunStepEntity);

      const run = await runRepo.save(
        runRepo.create({
          projectId: project.id,
          status: "pending",
          requestedPlanIds: selectedPlans.map((plan) => plan.id),
          requestedPlanCodes: selectedPlans.map((plan) => plan.code),
          inputSnapshot: {
            ...project.defaultParameters,
            ...(payload.parameters || {}),
          },
          source: payload.source || "api",
        }),
      );

      let sequence = 0;
      const steps = selectedPlans.flatMap((plan) =>
        (plan.steps || []).map((step: any, index: number) =>
          stepRepo.create({
            runId: run.id,
            planId: plan.id,
            stepId: String(step.id || `${plan.code}-step-${index + 1}`),
            sequence: (sequence += 1),
            stepName: String(step.name || step.type || `Step ${index + 1}`),
            stepType: String(step.type || "unknown"),
            status: "pending",
            diagnostics: {
              planCode: plan.code,
              stepIndex: index,
            },
          }),
        ),
      );
      if (steps.length > 0) {
        await stepRepo.save(steps);
      }

      return run;
    });

    const completedRun = await this.captureWorker.executeRun(run.id);
    return this.maskRun(completedRun, selectedPlans);
  }

  async listRunSteps(runId: string) {
    return this.runSteps.find({ where: { runId }, order: { sequence: "ASC", createdAt: "ASC" } });
  }

  async getRun(id: string) {
    const run = await this.runs.findOne({ where: { id } });
    if (!run) {
      throw new DomainError("CAPTURE_FAILED", `Capture run not found: ${id}`, HttpStatus.NOT_FOUND);
    }
    return this.maskRun(run, await this.plansForRun(run));
  }

  listAssets(runId?: string) {
    return this.assets.find({
      where: runId ? { runId } : {},
      order: { createdAt: "DESC" },
    });
  }

  async getAsset(id: string) {
    const asset = await this.assets.findOne({ where: { id } });
    if (!asset) {
      throw new DomainError("ASSET_NOT_FOUND", `Asset not found: ${id}`, HttpStatus.NOT_FOUND);
    }
    return asset;
  }

  async allocateAssetCode(projectId: string, projectCode: string, assetType: string, date = new Date()) {
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

  private async maskRuns(runs: CaptureRunEntity[]) {
    const planIds = Array.from(new Set(runs.flatMap((run) => run.requestedPlanIds || [])));
    const plans = planIds.length > 0 ? await this.plans.find({ where: { id: In(planIds) } }) : [];
    return runs.map((run) =>
      this.maskRun(run, plans.filter((plan) => (run.requestedPlanIds || []).includes(plan.id))),
    );
  }

  private async plansForRun(run: CaptureRunEntity) {
    const planIds = run.requestedPlanIds || [];
    return planIds.length > 0 ? this.plans.find({ where: { id: In(planIds) } }) : [];
  }

  private maskRun(run: CaptureRunEntity, plans: CapturePlanEntity[]) {
    return {
      ...run,
      inputSnapshot: this.maskParameterMap(run.inputSnapshot || {}, plans),
    };
  }

  private maskParameterMap(parameters: Record<string, unknown>, plans: CapturePlanEntity[]) {
    const secureKeys = new Set<string>();
    for (const plan of plans) {
      for (const item of plan.inputSchema || []) {
        const parameter = item as { name?: unknown; secure?: unknown; type?: unknown };
        if (
          typeof parameter.name === "string"
          && (parameter.secure === true || String(parameter.type || "").toLowerCase() === "password")
        ) {
          secureKeys.add(parameter.name);
        }
      }
    }

    return Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => [
        key,
        secureKeys.has(key) || this.isSensitiveKey(key) ? "***" : value,
      ]),
    );
  }

  private isSensitiveKey(key: string) {
    return /password|passwd|pwd|token|secret|credential|api[_-]?key/i.test(key);
  }
}
