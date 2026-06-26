import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'https://hisaflow.com',
      'https://www.hisaflow.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Add the custom header right here:
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'], 
    credentials: true,
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
}
bootstrap();