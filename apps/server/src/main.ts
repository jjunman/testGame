import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { uploadDirectory } from './common/upload';
import { mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  const corsOrigins = configService.get<string[]>('corsOrigins') ?? [];
  app.enableCors(corsOrigins.length > 0 ? { origin: corsOrigins } : undefined);
  mkdirSync(uploadDirectory, { recursive: true });
  app.useStaticAssets(uploadDirectory, { prefix: '/uploads' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new ResponseInterceptor(),
  );

  await app.listen(configService.get<number>('port') ?? 4000, '0.0.0.0');
}

bootstrap();
