export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/hisaflow',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  },
  africasTalking: {
    username: process.env.AFRICAS_TALKING_USERNAME || '',
    apiKey: process.env.AFRICAS_TALKING_API_KEY || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  cloudVision: {
    apiKey: process.env.CLOUD_VISION_API_KEY || '',
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || 'hisaflow-uploads',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },
  bullMQ: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
  posthog: {
    apiKey: process.env.POSTHOG_API_KEY || '',
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
  },
  // ── LLM Routing Gateway (LiteLLM Proxy) ──────────────────────────────
  // All AI inference is routed through this gateway. The gateway handles
  // load balancing across all providers and cascading failover.
  // Set LITELLM_BASE_URL to the Railway URL of the gateway service once
  // deployed. Falls back to localhost for local development.
  litellm: {
    baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000/v1',
    masterKey: process.env.LITELLM_MASTER_KEY || 'sk-hisaflow-local',
  },
});
