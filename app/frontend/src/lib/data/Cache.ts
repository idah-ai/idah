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
    const pattern = new RegExp(`^${cacheKey}-`);
    for (const key in cacheList) {
      if (key.match(pattern)) {
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

function runExpireCache() {
  // Every 10 seconds, cleanup the expired cache
  setInterval(() => {
    clearExpireCache();
  }, 10000);
}

runExpireCache();
