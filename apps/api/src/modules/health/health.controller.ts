import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  health() {
    return {
      status: "ok",
      service: "ieta-dyna-snapshot-api",
      timestamp: new Date().toISOString(),
    };
  }
}
