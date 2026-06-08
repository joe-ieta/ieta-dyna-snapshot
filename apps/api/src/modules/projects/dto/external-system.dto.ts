import { IsObject, IsOptional, IsString, IsUrl, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { codePattern } from "./validation";

export class CreateExternalSystemDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @Matches(codePattern)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  loginUrl?: string;

  @IsOptional()
  @IsString()
  browserProfileId?: string;

  @IsOptional()
  @IsObject()
  sessionPolicy?: Record<string, unknown>;
}

export class UpdateExternalSystemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  loginUrl?: string;

  @IsOptional()
  @IsObject()
  sessionPolicy?: Record<string, unknown>;
}
