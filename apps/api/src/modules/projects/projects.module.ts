import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CaptureWorkerModule } from "../capture-worker/capture-worker.module";
import { AssetEntity } from "../../database/entities/asset.entity";
import { AssetSequenceEntity } from "../../database/entities/asset-sequence.entity";
import { CapturePlanEntity } from "../../database/entities/capture-plan.entity";
import { CaptureRunEntity } from "../../database/entities/capture-run.entity";
import { ExternalSystemEntity } from "../../database/entities/external-system.entity";
import { ProjectEntity } from "../../database/entities/project.entity";
import { RunStepEntity } from "../../database/entities/run-step.entity";
import { AssetsController } from "./assets.controller";
import { CapturePlansController } from "./capture-plans.controller";
import { CaptureRunsController } from "./capture-runs.controller";
import { ExternalSystemsController } from "./external-systems.controller";
import { ProjectsController } from "./projects.controller";
import { SnapshotService } from "./snapshot.service";

@Module({
  imports: [
    CaptureWorkerModule,
    TypeOrmModule.forFeature([
      ProjectEntity,
      ExternalSystemEntity,
      CapturePlanEntity,
      CaptureRunEntity,
      AssetEntity,
      RunStepEntity,
      AssetSequenceEntity,
    ]),
  ],
  controllers: [
    ProjectsController,
    ExternalSystemsController,
    CapturePlansController,
    CaptureRunsController,
    AssetsController,
  ],
  providers: [SnapshotService],
})
export class ProjectsModule {}
