import { IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { codePattern } from "./validation";

export class CreateCapturePlanDto {
  @IsUUID()
  projectId!: string;

  @IsUUID()
  externalSystemId!: string;

  @IsString()
  @Matches(codePattern)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  steps?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  inputSchema?: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateCapturePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  steps?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  inputSchema?: Record<string, unknown>[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
