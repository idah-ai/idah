import type { IIdahDriverV2 } from "./types";

export function hasConfig(driver: IIdahDriverV2, type: string): boolean {
  const cfg = driver.config[type];
  return !!(cfg && cfg.values && cfg.values.length > 0);
}
