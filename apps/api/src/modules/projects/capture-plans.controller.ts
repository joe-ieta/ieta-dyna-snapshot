import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { SnapshotService } from "./snapshot.service";

@Controller("v1/capture-plans")
export class CapturePlansController {
  constructor(private readonly service: SnapshotService) {}

  @Get()
  @RequirePermissions("snapshot:plan:read")
  list(@Query("projectId") projectId?: string) {
    return this.service.listPlans(projectId);
  }

  @Post()
  @RequirePermissions("snapshot:plan:write")
  create(@Body() payload: any) {
    return this.service.createPlan(payload);
  }
}
