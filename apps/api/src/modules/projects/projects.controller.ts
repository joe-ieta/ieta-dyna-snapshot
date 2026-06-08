import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CreateProjectDto, UpdateProjectDto } from "./dto/project.dto";
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
  create(@Body() payload: CreateProjectDto) {
    return this.service.createProject(payload);
  }

  @Get(":code/inputs")
  @RequirePermissions("snapshot:project:read")
  inputs(@Param("code") code: string) {
    return this.service.getProjectInputs(code);
  }

  @Get(":id")
  @RequirePermissions("snapshot:project:read")
  detail(@Param("id") id: string) {
    return this.service.getProject(id);
  }

  @Patch(":id")
  @RequirePermissions("snapshot:project:write")
  update(@Param("id") id: string, @Body() payload: UpdateProjectDto) {
    return this.service.updateProject(id, payload);
  }
}
