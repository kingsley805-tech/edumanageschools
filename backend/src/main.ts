import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('EduManageBackend');
  const app = await NestFactory.create(AppModule);

  // Security headers & compression
  app.use(helmet());
  // app.use(compression());

  // CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-School-ID'],
  });

  // Global API Prefix
  const globalPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  // Global DTO Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EduManage Core API')
    .setDescription(
      'Robust multi-tenant School Management System REST API built with NestJS & PostgreSQL',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Bearer access token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Authentication', 'Session tokens, registration, credential recovery')
    .addTag('Academics', 'Classes, subjects, enrollments, attendance, report cards')
    .addTag('Billing & Finance', 'Fee structures, invoices, POS receipts, payment gateways')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
    customSiteTitle: 'EduManage API Documentation',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 EduManage NestJS Backend listening on port: ${port}`);
  logger.log(`📡 Base API URL: http://localhost:${port}/${globalPrefix}`);
  logger.log(`📖 Swagger API Docs: http://localhost:${port}/docs`);
  logger.log(`=======================================================`);
}

bootstrap();
