import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { TriggerCaptureRunDto } from "./dto/capture-run.dto";
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
  trigger(@Body() payload: TriggerCaptureRunDto) {
    return this.service.triggerRun(payload);
  }

  @Get(":id")
  @RequirePermissions("snapshot:run:execute")
  detail(@Param("id") id: string) {
    return this.service.getRun(id);
  }

  @Get(":id/steps")
  @RequirePermissions("snapshot:run:execute")
  steps(@Param("id") id: string) {
    return this.service.listRunSteps(id);
  }
}
