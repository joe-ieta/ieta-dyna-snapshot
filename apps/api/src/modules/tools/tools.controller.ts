import { Body, Controller, Get, HttpStatus, Param, Post, Query, Req, Res, UseFilters } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { createReadStream } from "fs";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { DomainError } from "../../common/errors/domain-error";
import { RenderUrlDto } from "./dto/render-url.dto";
import { ToolsExceptionFilter } from "./tools-exception.filter";
import { UrlRendererService } from "./url-renderer.service";

@Controller("v1/tools")
@UseFilters(new ToolsExceptionFilter())
export class ToolsController {
  constructor(private readonly urlRenderer: UrlRendererService) {}

  @Post("render-url")
  @RequirePermissions("snapshot:run:execute")
  async renderUrl(@Body() payload: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    const dto = this.validateRenderUrlPayload(payload);
    const asset = await this.urlRenderer.renderUrl(dto);
    const access = this.urlRenderer.createAssetAccess(asset.fileName);
    const assetUrl = this.absoluteUrl(
      request,
      `/api/v1/tools/assets/${encodeURIComponent(asset.fileName)}?expires=${access.expires}&token=${encodeURIComponent(access.token)}`,
    );
    return response.json({
      success: true,
      fileName: asset.fileName,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      filePath: asset.filePath,
      assetUrl,
    });
  }

  @Get("assets/:filename")
  @Public()
  async getRenderedAsset(
    @Param("filename") filename: string,
    @Query("token") token: string | undefined,
    @Query("expires") expires: string | undefined,
    @Res() response: Response,
  ) {
    this.urlRenderer.validateAssetAccess(filename, token, expires);
    const asset = await this.urlRenderer.getAsset(filename);
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Content-Disposition", `inline; filename="${asset.fileName}"`);
    return createReadStream(asset.filePath).pipe(response);
  }

  private absoluteUrl(request: Request, path: string) {
    const forwardedProto = request.headers["x-forwarded-proto"];
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const protocol = proto || request.protocol || "http";
    return `${protocol}://${request.get("host")}${path}`;
  }

  private validateRenderUrlPayload(payload: Record<string, unknown>) {
    const dto = plainToInstance(RenderUrlDto, payload);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length === 0) return dto;

    throw new DomainError(
      "INPUT_VALIDATION_FAILED",
      "Request validation failed",
      HttpStatus.UNPROCESSABLE_ENTITY,
      errors.map((error) => ({
        field: error.property,
        constraints: error.constraints,
      })),
    );
  }
}
