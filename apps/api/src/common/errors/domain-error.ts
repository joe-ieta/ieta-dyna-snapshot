import { HttpException, HttpStatus } from "@nestjs/common";

export type DomainErrorCode =
  | "PROJECT_NOT_FOUND"
  | "SYSTEM_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "INPUT_VALIDATION_FAILED"
  | "DUPLICATE_CODE"
  | "LOGIN_REQUIRED"
  | "SESSION_EXPIRED"
  | "CAPTURE_FAILED"
  | "ASSET_NOT_FOUND"
  | "ASSET_ACCESS_DENIED"
  | "ASSET_WRITE_FAILED";

export class DomainError extends HttpException {
  constructor(
    code: DomainErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
