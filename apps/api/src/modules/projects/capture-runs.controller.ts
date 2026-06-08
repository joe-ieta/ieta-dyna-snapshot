import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { SnapshotService } from "./snapshot.service";

@Controller("v1/capture-runs")
export class CaptureRunsController {
  constructor(private readonly service: SnapshotService) {}

  @Get()
  @RequirePermissions("snapshot:run:execute")
  list(@Query("projectId") projectId?: string) {
    return this.service.listRuns(projectId);
  }

  @Post()
  @RequirePermissions("snapshot:run:execute")
  trigger(@Body() payload: any) {
    return this.service.triggerRun(
      payload.projectCode,
      payload.planCodes || [],
      payload.parameters || {},
    );
  }
}
