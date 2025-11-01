import { Redis } from '@upstash/redis';
import { getRuntimeConfig } from '../config/runtime';

let singleton: Redis | null = null;

export function getRedisClient(): Redis | null {
  const config = getRuntimeConfig();
  
  if (!config.UPSTASH_REDIS_REST_URL || !config.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (singleton) return singleton;

  singleton = new Redis({
    url: config.UPSTASH_REDIS_REST_URL,
    token: config.UPSTASH_REDIS_REST_TOKEN,
  });

  return singleton;
}

export async function getCachedJSON<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const response = await client.get<T>(key);
    return response ?? null;
  } catch {
    return null;
  }
}

export async function setCachedJSON<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch {
    // Silently fail if Redis is unavailable
  }
}

