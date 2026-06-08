import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import { extname } from "path";
import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
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

  @Get(":id/content")
  @RequirePermissions("snapshot:asset:read")
  async content(@Param("id") id: string, @Res() response: Response) {
    const asset = await this.service.getAsset(id);
    if (asset.contentType === "application/json") {
      const raw = await readFile(asset.filePath, "utf8");
      return response.type(asset.contentType).send(JSON.parse(raw));
    }
    if (asset.contentType.startsWith("text/")) {
      return response.type(asset.contentType).send(await readFile(asset.filePath, "utf8"));
    }
    return response.type(asset.contentType).send(await readFile(asset.filePath));
  }

  @Get(":id/download")
  @RequirePermissions("snapshot:asset:read")
  async download(@Param("id") id: string, @Res() response: Response) {
    const asset = await this.service.getAsset(id);
    const filename = `${asset.assetCode}${extname(asset.filePath)}`;
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return createReadStream(asset.filePath).pipe(response);
  }
}
