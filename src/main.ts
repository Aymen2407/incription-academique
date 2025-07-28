import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as compression from "compression";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: "*",
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  });
  app.use(compression());
  await app.listen(3000);
}

bootstrap();

