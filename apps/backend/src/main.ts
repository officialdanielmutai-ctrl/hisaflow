import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserves the unparsed request body on `req.rawBody`.
  // Paystack webhook signature verification MUST run against the raw bytes —
  // re-serializing the parsed JSON breaks the HMAC-SHA512 digest (Section 3.4).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3002',
      'https://hisaflow.com',
      'https://www.hisaflow.com',
      'https://admin.hisaflow.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-organization-id',
      'x-impersonation-token',
    ],
    credentials: true,
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
}
bootstrap();