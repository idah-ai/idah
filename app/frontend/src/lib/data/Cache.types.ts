import type { Hash } from "@/utils/types";

export type CacheValue = Hash;

export type CacheData = {
  value: CacheValue;
  expireIn: number;
};

export type CacheList = {
  [key: string]: CacheData;
};
