import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserves the unparsed request body on `req.rawBody`.
  // Paystack webhook signature verification MUST run against the raw bytes —
  // re-serializing the parsed JSON breaks the HMAC-SHA512 digest (Section 3.4).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(
    new Set(
      [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
        ...configuredOrigins,
        'http://localhost:3000',
        'http://localhost:3002',
        'https://hisaflow.co.ke',
        'https://www.hisaflow.co.ke',
        'https://app.hisaflow.co.ke',
        'https://admin.hisaflow.co.ke',
        'https://hisaflow.com',
        'https://www.hisaflow.com',
        'https://admin.hisaflow.com',
      ].filter((origin): origin is string => Boolean(origin))
    )
  );

  app.enableCors({
    origin: allowedOrigins,
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