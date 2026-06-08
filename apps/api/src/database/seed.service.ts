import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PermissionEntity } from "./entities/permission.entity";
import { RoleEntity } from "./entities/role.entity";
import { UserEntity } from "./entities/user.entity";
import { hashPassword } from "../modules/security/password";

const permissions = [
  "snapshot:project:read",
  "snapshot:project:write",
  "snapshot:plan:read",
  "snapshot:plan:write",
  "snapshot:run:execute",
  "snapshot:asset:read",
  "snapshot:system:admin",
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async onModuleInit() {
    const savedPermissions = [];
    for (const code of permissions) {
      let permission = await this.permissionRepo.findOne({ where: { code } });
      if (!permission) {
        permission = await this.permissionRepo.save(
          this.permissionRepo.create({ code, name: code }),
        );
      }
      savedPermissions.push(permission);
    }

    let adminRole = await this.roleRepo.findOne({ where: { code: "admin" } });
    if (!adminRole) {
      adminRole = this.roleRepo.create({
        code: "admin",
        name: "Administrator",
        permissions: savedPermissions,
      });
    } else {
      adminRole.permissions = savedPermissions;
    }
    await this.roleRepo.save(adminRole);

    const existing = await this.userRepo.findOne({ where: { username: "admin" } });
    if (!existing) {
      await this.userRepo.save(
        this.userRepo.create({
          username: "admin",
          displayName: "系统管理员",
          passwordHash: await hashPassword("admin123456"),
          roles: [adminRole],
        }),
      );
      this.logger.log("Seeded default admin user: admin / admin123456");
    }
  }
}
