import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __chrono_redis: Redis | null | undefined;
}

function getRedis(): Redis | null {
  if (globalThis.__chrono_redis !== undefined) return globalThis.__chrono_redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    globalThis.__chrono_redis = null;
    return null;
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    // Logging only - the route layer will fall back to DB locking if Redis is
    // unavailable. We do not crash the process.
    // eslint-disable-next-line no-console
    console.warn("[redis]", err.message);
  });
  globalThis.__chrono_redis = client;
  return client;
}

export interface AtomicLockHandle {
  release: () => Promise<void>;
}

/**
 * Acquires a short-lived atomic lock on the given key (typically scoped per
 * user, e.g. `gen:user:42`) using SET NX PX in Redis. Returns null when the
 * lock is already held by another caller, allowing the application to short-
 * circuit a concurrent request immediately.
 *
 * When REDIS_URL is unset, this function returns a no-op handle. The route
 * layer must then fall back to Postgres SELECT ... FOR UPDATE (which it does
 * regardless of Redis availability — Redis is the *fast* path).
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
): Promise<AtomicLockHandle | null> {
  const redis = getRedis();
  if (!redis) {
    return { release: async () => {} };
  }
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const res = await redis.set(`lock:${key}`, token, "PX", ttlMs, "NX");
  if (res !== "OK") return null;
  return {
    release: async () => {
      // Compare-and-delete: only release the lock if we still own it.
      const script = `
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        else
          return 0
        end
      `;
      try {
        await redis.eval(script, 1, `lock:${key}`, token);
      } catch {
        // best-effort
      }
    },
  };
}
