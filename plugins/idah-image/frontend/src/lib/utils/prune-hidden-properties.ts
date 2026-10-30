import type { IConfigProperty, IIdahDriverV2 } from "$idah/v2/types";

export function pruneHiddenProperties(
  driver: IIdahDriverV2,
  shapeType: string,
  category: string | undefined,
  input: Record<string, unknown>,
): { properties: Record<string, unknown>; fields: IConfigProperty[] } | undefined {
  const properties = { ...input };
  for (;;) {
    const config = driver.getFilteredConfig(shapeType, { category, properties });
    if (!config) return undefined;
    const visible = new Set(config.properties.map((field) => field.id));
    const hidden = Object.keys(properties).filter((id) => !visible.has(id));
    if (!hidden.length) return { properties, fields: config.properties };
    for (const id of hidden) delete properties[id];
  }
}
