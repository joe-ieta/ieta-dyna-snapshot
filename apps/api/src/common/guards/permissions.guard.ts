import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { UserEntity } from "../../database/entities/user.entity";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: UserEntity }>();
    const user = request.user;
    const granted = new Set(
      user?.roles?.flatMap((role) => role.permissions?.map((permission) => permission.code) || []) || [],
    );

    if (required.some((permission) => granted.has(permission))) {
      return true;
    }

    throw new ForbiddenException(`Missing required permission: ${required.join(", ")}`);
  }
}
