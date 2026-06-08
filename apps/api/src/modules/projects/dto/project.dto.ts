import { IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { codePattern } from "./validation";

export class CreateProjectDto {
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
  @IsString()
  assetRoot?: string;

  @IsOptional()
  @IsObject()
  defaultParameters?: Record<string, unknown>;
}

export class UpdateProjectDto {
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
  @IsString()
  assetRoot?: string;

  @IsOptional()
  @IsObject()
  defaultParameters?: Record<string, unknown>;
}
