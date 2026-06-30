import type { Hash } from "@/utils/types";

/**
 * Parse filter entries from a URL's searchParams.
 * Handles scalar values (filters[name]=val) and arrays (filters[name][]=val1&filters[name][]=val2).
 */
export function parseUrlFilters(url: URL): Hash {
  const out: Hash = {};
  url.searchParams.forEach((value, key) => {
    const arrayMatch = key.match(/^filters\[([^\]]+)\]\[\]$/);
    const scalarMatch = key.match(/^filters\[([^\]]+)\]$/);
    if (arrayMatch) {
      const k = arrayMatch[1];
      if (!out[k]) out[k] = [];
      (out[k] as unknown[]).push(value);
    } else if (scalarMatch) {
      out[scalarMatch[1]] = value;
    }
  });
  return out;
}

/**
 * Serialize a single filter value into URL search params.
 * Scalar → filters[key]=val; array → filters[key][]=val1&filters[key][]=val2.
 */
export function writeFilterToUrl(params: URLSearchParams, key: string, value: unknown): void {
  params.delete(`filters[${key}]`);
  params.delete(`filters[${key}][]`);
  if (Array.isArray(value)) {
    for (const item of value) {
      params.append(`filters[${key}][]`, String(item));
    }
  } else if (value !== undefined && value !== null) {
    params.set(`filters[${key}]`, String(value));
  }
}
