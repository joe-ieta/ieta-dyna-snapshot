import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CreateCapturePlanDto, UpdateCapturePlanDto } from "./dto/capture-plan.dto";
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
  create(@Body() payload: CreateCapturePlanDto) {
    return this.service.createPlan(payload);
  }

  @Get(":id")
  @RequirePermissions("snapshot:plan:read")
  detail(@Param("id") id: string) {
    return this.service.getPlan(id);
  }

  @Patch(":id")
  @RequirePermissions("snapshot:plan:write")
  update(@Param("id") id: string, @Body() payload: UpdateCapturePlanDto) {
    return this.service.updatePlan(id, payload);
  }
}
