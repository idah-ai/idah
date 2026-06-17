export const categoryOrderMap: Record<string, number> = {};

/** Get the sort order for a category path. Returns undefined if not in map. */
export function getCategoryOrder(path: string): number | undefined {
  return categoryOrderMap[path];
}

/** Get all sibling orders for a given parent prefix. */
export function getSiblingOrders(parentPrefix: string): Array<{ path: string; order: number }> {
  const result: Array<{ path: string; order: number }> = [];
  const prefix = parentPrefix ? parentPrefix + "/" : "";

  for (const [key, order] of Object.entries(categoryOrderMap)) {
    if (key === parentPrefix) continue;
    const isSibling = parentPrefix
      ? key.startsWith(prefix) && !key.slice(prefix.length).includes("/")
      : !key.includes("/");
    if (isSibling) {
      result.push({ path: key, order });
    }
  }

  return result.sort((a, b) => a.order - b.order);
}
