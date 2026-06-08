import { IsArray, IsIn, IsObject, IsOptional, IsString, Matches } from "class-validator";
import { codePattern } from "./validation";

export class TriggerCaptureRunDto {
  @IsString()
  @Matches(codePattern)
  projectCode!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(codePattern, { each: true })
  planCodes?: string[];

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsIn(["manual", "api"])
  source?: "manual" | "api";
}
