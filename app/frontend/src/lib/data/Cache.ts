import type { CacheList, CacheValue } from "@/data/Cache.types";

let cacheList: CacheList = {};

export const setCache = (
  cacheKey: string,
  cacheSignature: string,
  cacheValue: CacheValue,
  expireInMinute: number = 3,
) => {
  const key = `${cacheKey}-${cacheSignature}`;

  cacheList[key] = {
    value: cacheValue,
    expireIn: Date.now() + expireInMinute * 60 * 1_000,
  };
};

export const getCache = (cacheKey: string, cacheSignature: string): CacheValue => {
  const key = `${cacheKey}-${cacheSignature}`;

  return cacheList[key]?.value || undefined;
};

export const clearCache = (cacheKey: string, cacheSignature: string | undefined = undefined) => {
  if (cacheSignature) {
    const key = `${cacheKey}-${cacheSignature}`;
    delete cacheList[key];
  } else {
    // Prefix match without a RegExp: cacheKey may contain regex
    // metacharacters, which could over-match unrelated entries or ReDoS.
    const prefix = `${cacheKey}-`;
    for (const key in cacheList) {
      if (key.startsWith(prefix)) {
        delete cacheList[key];
      }
    }
  }
};

export const clearAllCache = () => {
  cacheList = {};
};

function clearExpireCache() {
  const now = Date.now();

  for (const key in cacheList) {
    if (cacheList[key].expireIn < now) {
      delete cacheList[key];
    }
  }
}

let expireTimer: ReturnType<typeof setInterval> | undefined;

// Every 10 seconds, cleanup the expired cache. The handle is stored so the
// timer can be stopped (tests/SSR/HMR) instead of leaking the event loop.
export function startExpireCache() {
  expireTimer ??= setInterval(clearExpireCache, 10_000);
}

export function stopExpireCache() {
  if (expireTimer) clearInterval(expireTimer);
  expireTimer = undefined;
}

if (typeof window !== "undefined") startExpireCache();
