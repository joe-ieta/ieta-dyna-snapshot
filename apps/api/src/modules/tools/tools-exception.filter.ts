import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ToolsExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const message = this.messageFrom(payload.message, exception);

    return response.status(status).json({
      success: false,
      code: typeof payload.code === "string" ? payload.code : "TOOL_REQUEST_FAILED",
      message,
      ...(payload.details ? { details: payload.details } : {}),
    });
  }

  private messageFrom(value: unknown, exception: unknown) {
    if (Array.isArray(value)) return value.join("; ");
    if (typeof value === "string") return value;
    if (exception instanceof Error) return exception.message;
    return String(exception);
  }
}
