import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AssetEntity } from "../../database/entities/asset.entity";
import { AssetSequenceEntity } from "../../database/entities/asset-sequence.entity";
import { CapturePlanEntity } from "../../database/entities/capture-plan.entity";
import { CaptureRunEntity } from "../../database/entities/capture-run.entity";
import { ExternalSystemEntity } from "../../database/entities/external-system.entity";
import { ProjectEntity } from "../../database/entities/project.entity";
import { RunStepEntity } from "../../database/entities/run-step.entity";
import { BrowserSessionService } from "./browser-session.service";
import { CaptureWorkerService } from "./capture-worker.service";

@Module({
  imports: [
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
  providers: [BrowserSessionService, CaptureWorkerService],
  exports: [BrowserSessionService, CaptureWorkerService],
})
export class CaptureWorkerModule {}
