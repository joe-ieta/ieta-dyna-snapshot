import "reflect-metadata";
import { Logger, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
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
  assertSafeExposure(config, host);

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
      exceptionFactory: (errors) =>
        new UnprocessableEntityException({
          code: "INPUT_VALIDATION_FAILED",
          message: "Request validation failed",
          details: errors.map((error) => ({
            field: error.property,
            constraints: error.constraints,
          })),
        }),
    }),
  );

  const documentConfig = new DocumentBuilder()
    .setTitle("Dyna Snapshot API")
    .setDescription("Local web snapshot and structured data capture management API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", in: "header", name: "X-API-Token" }, "ApiToken")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, documentConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, host);
  logger.log(`API listening on http://${host}:${port}`);
  logger.log(`Swagger available at http://${host}:${port}/api/docs`);
}

bootstrap();

function assertSafeExposure(config: ConfigService, host: string) {
  if (isLocalHost(host)) return;

  const jwtSecret = config.get<string>("JWT_SECRET", "");
  const apiTokens = [
    config.get<string>("SNAPSHOT_API_TOKEN", ""),
    ...config.get<string>("SNAPSHOT_API_TOKENS", "").split(","),
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  const hasStrongJwtSecret = jwtSecret.length >= 32 && jwtSecret !== "local-dev-secret";
  const hasStrongApiToken = apiTokens.some((token) => token.length >= 24);
  if (hasStrongJwtSecret && hasStrongApiToken) return;

  throw new Error(
    "Refusing non-local API exposure. Set JWT_SECRET to at least 32 characters and configure SNAPSHOT_API_TOKEN or SNAPSHOT_API_TOKENS with a token of at least 24 characters.",
  );
}

function isLocalHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized.startsWith("127.")
  );
}
