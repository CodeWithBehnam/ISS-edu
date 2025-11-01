import { z } from 'zod';

const runtimeSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  NASA_API_KEY: z.string().min(1).optional(),
  TELEMETRY_CACHE_TTL_SECONDS: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number.parseInt(value, 10))
    .default('15'),
  TELEMETRY_DRIFT_THRESHOLD_KM: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform((value) => Number.parseFloat(value))
    .default('10'),
});

export type RuntimeConfig = z.infer<typeof runtimeSchema>;

let cachedConfig: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = runtimeSchema.safeParse({
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NASA_API_KEY: process.env.NASA_API_KEY,
    TELEMETRY_CACHE_TTL_SECONDS: process.env.TELEMETRY_CACHE_TTL_SECONDS,
    TELEMETRY_DRIFT_THRESHOLD_KM: process.env.TELEMETRY_DRIFT_THRESHOLD_KM,
  });

  if (!parsed.success) {
    const errors = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('; ');
    throw new Error(`Runtime configuration invalid: ${errors}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

