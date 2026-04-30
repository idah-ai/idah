import type { IConfig, IConfigValue } from "$idah/context/activity-context";

export function findCategory(props: {
  labelConfig: IConfig;
  categoryId: string | undefined;
  shapeType: string;
}): IConfigValue | undefined {
  const { labelConfig, categoryId, shapeType } = props;

  if (!categoryId) return undefined;

  const shapeConfig = labelConfig[shapeType];
  if (!shapeConfig) return undefined;

  return shapeConfig.values.find((category) => category.id == categoryId);
}
