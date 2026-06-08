import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("API_PORT", 4310);
  const host = config.get<string>("API_HOST", "127.0.0.1");

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: config
        .get<string>("CORS_ORIGINS", "http://127.0.0.1:4311,http://localhost:4311")
        .split(",")
        .map((item) => item.trim()),
      credentials: true,
    }),
  );

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      errorHttpStatusCode: 422,
    }),
  );

  const documentConfig = new DocumentBuilder()
    .setTitle("Dyna Snapshot API")
    .setDescription("Local web snapshot and structured data capture management API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, documentConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, host);
  logger.log(`API listening on http://${host}:${port}`);
  logger.log(`Swagger available at http://${host}:${port}/api/docs`);
}

bootstrap();
