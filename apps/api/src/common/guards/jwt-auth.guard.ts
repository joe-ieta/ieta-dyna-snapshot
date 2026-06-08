import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Request } from "express";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const apiTokenPermissions = [
  "snapshot:project:read",
  "snapshot:plan:read",
  "snapshot:run:execute",
  "snapshot:asset:read",
];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: UserEntity }>();
    const apiToken = this.extractApiToken(request);
    if (apiToken && this.isValidApiToken(apiToken)) {
      request.user = this.apiTokenUser();
      return true;
    }

    const header = request.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.users.findOne({ where: { id: payload.sub } });
      if (!user || !user.enabled) {
        throw new UnauthorizedException("User is disabled or not found");
      }
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }

  private extractApiToken(request: Request) {
    const headerToken = request.headers["x-api-token"] || request.headers["x-snapshot-api-token"];
    if (Array.isArray(headerToken)) return headerToken[0];
    return headerToken;
  }

  private isValidApiToken(token: string) {
    const configured = [
      this.config.get<string>("SNAPSHOT_API_TOKEN", ""),
      ...this.config.get<string>("SNAPSHOT_API_TOKENS", "").split(","),
    ]
      .map((item) => item.trim())
      .filter(Boolean);
    return configured.includes(token);
  }

  private apiTokenUser() {
    return {
      id: "api-token",
      username: "api-token",
      displayName: "External API Token",
      enabled: true,
      roles: [{
        code: "api-token",
        name: "External API Token",
        permissions: apiTokenPermissions.map((code) => ({ code, name: code })),
      }],
    } as UserEntity;
  }
}
