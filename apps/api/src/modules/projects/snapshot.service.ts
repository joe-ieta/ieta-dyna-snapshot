import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AssetEntity } from "../../database/entities/asset.entity";
import { CapturePlanEntity } from "../../database/entities/capture-plan.entity";
import { CaptureRunEntity } from "../../database/entities/capture-run.entity";
import { ExternalSystemEntity } from "../../database/entities/external-system.entity";
import { ProjectEntity } from "../../database/entities/project.entity";

@Injectable()
export class SnapshotService {
  constructor(
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
  ) {}

  listProjects() {
    return this.projects.find({ order: { createdAt: "DESC" } });
  }

  async createProject(payload: Partial<ProjectEntity>) {
    const project = this.projects.create({
      code: payload.code,
      name: payload.name,
      description: payload.description || "",
      assetRoot: payload.assetRoot || `data/assets/${payload.code}`,
      defaultParameters: payload.defaultParameters || {},
    });
    return this.projects.save(project);
  }

  async findProjectByCode(code: string) {
    const project = await this.projects.findOne({ where: { code } });
    if (!project) throw new NotFoundException(`Project not found: ${code}`);
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
      projectDefaults: project.defaultParameters,
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

  createSystem(payload: Partial<ExternalSystemEntity>) {
    return this.systems.save(
      this.systems.create({
        ...payload,
        browserProfileId:
          payload.browserProfileId || `${payload.projectId || "project"}/${payload.code || "system"}`,
        sessionPolicy: payload.sessionPolicy || {},
      }),
    );
  }

  listPlans(projectId?: string) {
    return this.plans.find({
      where: projectId ? { projectId } : {},
      order: { createdAt: "DESC" },
    });
  }

  createPlan(payload: Partial<CapturePlanEntity>) {
    return this.plans.save(
      this.plans.create({
        ...payload,
        steps: payload.steps || [],
        inputSchema: payload.inputSchema || [],
        enabled: payload.enabled ?? true,
      }),
    );
  }

  listRuns(projectId?: string) {
    return this.runs.find({
      where: projectId ? { projectId } : {},
      order: { createdAt: "DESC" },
    });
  }

  async triggerRun(projectCode: string, planCodes: string[], parameters: Record<string, unknown>) {
    const project = await this.findProjectByCode(projectCode);
    const plans = await this.plans.find({ where: { projectId: project.id } });
    const selectedPlans = planCodes.length
      ? plans.filter((plan) => planCodes.includes(plan.code))
      : plans;

    return this.runs.save(
      this.runs.create({
        projectId: project.id,
        status: "pending",
        requestedPlanIds: selectedPlans.map((plan) => plan.id),
        inputSnapshot: {
          ...project.defaultParameters,
          ...parameters,
        },
        source: "api",
      }),
    );
  }

  listAssets(runId?: string) {
    return this.assets.find({
      where: runId ? { runId } : {},
      order: { createdAt: "DESC" },
    });
  }
}
