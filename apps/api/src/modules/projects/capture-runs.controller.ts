import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiSecurity } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { TriggerCaptureRunDto } from "./dto/capture-run.dto";
import { SnapshotService } from "./snapshot.service";

@Controller("v1/capture-runs")
@ApiBearerAuth()
@ApiSecurity("ApiToken")
@ApiHeader({
  name: "X-API-Token",
  required: false,
  description: "External automation token. Use this instead of JWT for non-interactive callers.",
})
export class CaptureRunsController {
  constructor(private readonly service: SnapshotService) {}

  @Get()
  @ApiOperation({ summary: "List capture runs" })
  @RequirePermissions("snapshot:run:execute")
  list(@Query("projectId") projectId?: string) {
    return this.service.listRuns(projectId);
  }

  @Post()
  @ApiOperation({ summary: "Trigger capture run by project code and optional plan codes" })
  @ApiBody({
    type: TriggerCaptureRunDto,
    examples: {
      externalCaller: {
        summary: "External report material collection",
        value: {
          projectCode: "REPORT_DEMO",
          planCodes: ["DASHBOARD_DAILY"],
          parameters: {
            reportDate: "2026-06-08",
            regionCode: "EAST",
          },
          source: "api",
        },
      },
    },
  })
  @RequirePermissions("snapshot:run:execute")
  trigger(@Body() payload: TriggerCaptureRunDto) {
    return this.service.triggerRun(payload);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get capture run detail" })
  @RequirePermissions("snapshot:run:execute")
  detail(@Param("id") id: string) {
    return this.service.getRun(id);
  }

  @Get(":id/steps")
  @ApiOperation({ summary: "List capture run step diagnostics" })
  @RequirePermissions("snapshot:run:execute")
  steps(@Param("id") id: string) {
    return this.service.listRunSteps(id);
  }
}
