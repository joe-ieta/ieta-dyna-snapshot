import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { BrowserSessionService } from "../capture-worker/browser-session.service";
import { CreateExternalSystemDto, UpdateExternalSystemDto } from "./dto/external-system.dto";
import { SnapshotService } from "./snapshot.service";

@Controller("v1/external-systems")
export class ExternalSystemsController {
  constructor(
    private readonly service: SnapshotService,
    private readonly browserSessions: BrowserSessionService,
  ) {}

  @Get()
  @RequirePermissions("snapshot:project:read")
  list(@Query("projectId") projectId?: string) {
    return this.service.listSystems(projectId);
  }

  @Post()
  @RequirePermissions("snapshot:project:write")
  create(@Body() payload: CreateExternalSystemDto) {
    return this.service.createSystem(payload);
  }

  @Get(":id")
  @RequirePermissions("snapshot:project:read")
  detail(@Param("id") id: string) {
    return this.service.getSystem(id);
  }

  @Patch(":id")
  @RequirePermissions("snapshot:project:write")
  update(@Param("id") id: string, @Body() payload: UpdateExternalSystemDto) {
    return this.service.updateSystem(id, payload);
  }

  @Get(":id/session")
  @RequirePermissions("snapshot:project:read")
  async sessionStatus(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.getSessionStatus(project, system);
  }

  @Post(":id/session/open")
  @RequirePermissions("snapshot:system:admin")
  async openSession(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.openInteractiveSession(project, system);
  }

  @Post(":id/session/refresh")
  @RequirePermissions("snapshot:system:admin")
  async refreshSession(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.refreshSession(project, system);
  }

  @Delete(":id/session")
  @RequirePermissions("snapshot:system:admin")
  async clearSession(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.clearSession(project, system);
  }

  @Get(":id/marking")
  @RequirePermissions("snapshot:project:read")
  async markingStatus(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.getDomMarkingStatus(project, system);
  }

  @Post(":id/marking/start")
  @RequirePermissions("snapshot:system:admin")
  async startMarking(@Param("id") id: string, @Body() payload?: { clear?: boolean }) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.startDomMarking(project, system, { clear: !!payload?.clear });
  }

  @Post(":id/marking/stop")
  @RequirePermissions("snapshot:system:admin")
  async stopMarking(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.stopDomMarking(project, system);
  }

  @Delete(":id/marking/selections")
  @RequirePermissions("snapshot:system:admin")
  async clearMarkingSelections(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.clearDomMarkingSelections(project, system);
  }

  @Post(":id/marking/scan-inputs")
  @RequirePermissions("snapshot:system:admin")
  async scanInputParameters(@Param("id") id: string) {
    const system = await this.service.getSystem(id);
    const project = await this.service.getProject(system.projectId);
    return this.browserSessions.scanInputParameters(project, system);
  }
}
