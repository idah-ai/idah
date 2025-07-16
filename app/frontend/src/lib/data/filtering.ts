import type { Hash } from "@/utils/types";

export type Filters = {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [key: string]: any
}

export const filtersToHash = (filters: Filters): Hash => {
  const out: Hash = {}

  for (const key in filters) {
    const value = filters[key]

    if (out[key]) {
      if (!(out[key] instanceof Array)) {
        out[key].push(value)
      } else {
        out[key] = [out[key], value]
      }
    } else {
      out[key] = value
    }
  }

  return out
}
