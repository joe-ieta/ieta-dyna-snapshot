import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { SnapshotService } from "./snapshot.service";

@Controller("v1/projects")
export class ProjectsController {
  constructor(private readonly service: SnapshotService) {}

  @Get()
  @RequirePermissions("snapshot:project:read")
  list() {
    return this.service.listProjects();
  }

  @Post()
  @RequirePermissions("snapshot:project:write")
  create(@Body() payload: any) {
    return this.service.createProject(payload);
  }

  @Get(":code/inputs")
  @RequirePermissions("snapshot:project:read")
  inputs(@Param("code") code: string) {
    return this.service.getProjectInputs(code);
  }
}
