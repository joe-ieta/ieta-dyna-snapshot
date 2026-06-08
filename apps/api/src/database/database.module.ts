import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, type TypeOrmModuleOptions } from "@nestjs/typeorm";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { AssetEntity } from "./entities/asset.entity";
import { CapturePlanEntity } from "./entities/capture-plan.entity";
import { CaptureRunEntity } from "./entities/capture-run.entity";
import { ExternalSystemEntity } from "./entities/external-system.entity";
import { PermissionEntity } from "./entities/permission.entity";
import { ProjectEntity } from "./entities/project.entity";
import { RoleEntity } from "./entities/role.entity";
import { UserEntity } from "./entities/user.entity";
import { SeedService } from "./seed.service";

const entities = [
  UserEntity,
  RoleEntity,
  PermissionEntity,
  ProjectEntity,
  ExternalSystemEntity,
  CapturePlanEntity,
  CaptureRunEntity,
  AssetEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const sqlitePath = resolve(
          process.cwd(),
          config.get<string>("SQLITE_PATH", "../../data/app.db"),
        );
        mkdirSync(dirname(sqlitePath), { recursive: true });

        return {
          type: "sqljs",
          location: sqlitePath,
          autoSave: true,
          entities,
          synchronize: true,
          autoLoadEntities: true,
        };
      },
    }),
    TypeOrmModule.forFeature(entities),
  ],
  providers: [SeedService],
  exports: [TypeOrmModule, SeedService],
})
export class DatabaseModule {}
