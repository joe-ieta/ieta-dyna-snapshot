import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, Matches, Max, Min } from "class-validator";

export type RenderOutputType = "pdf" | "png" | "jpg";

export class RenderUrlDto {
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  url!: string;

  @IsString()
  @IsIn(["pdf", "png", "jpg"])
  outputType!: RenderOutputType;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/)
  fileNameId!: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  @IsIn(["load", "domcontentloaded", "networkidle"])
  waitUntil?: "load" | "domcontentloaded" | "networkidle";

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;
}
