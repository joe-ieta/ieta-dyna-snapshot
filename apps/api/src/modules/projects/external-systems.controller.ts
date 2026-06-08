import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { SnapshotService } from "./snapshot.service";

@Controller("v1/external-systems")
export class ExternalSystemsController {
  constructor(private readonly service: SnapshotService) {}

  @Get()
  @RequirePermissions("snapshot:project:read")
  list(@Query("projectId") projectId?: string) {
    return this.service.listSystems(projectId);
  }

  @Post()
  @RequirePermissions("snapshot:project:write")
  create(@Body() payload: any) {
    return this.service.createSystem(payload);
  }
}
