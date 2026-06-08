import { Controller, Get, Query } from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { SnapshotService } from "./snapshot.service";

@Controller("v1/assets")
export class AssetsController {
  constructor(private readonly service: SnapshotService) {}

  @Get()
  @RequirePermissions("snapshot:asset:read")
  list(@Query("runId") runId?: string) {
    return this.service.listAssets(runId);
  }
}
