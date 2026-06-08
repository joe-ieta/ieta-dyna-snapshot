import { Module } from "@nestjs/common";
import { ToolsController } from "./tools.controller";
import { UrlRendererService } from "./url-renderer.service";

@Module({
  controllers: [ToolsController],
  providers: [UrlRendererService],
})
export class ToolsModule {}
