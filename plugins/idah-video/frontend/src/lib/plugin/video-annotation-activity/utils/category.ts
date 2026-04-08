import type { IConfig, IConfigValue } from "$idah/context/activity-context";

export function findCategory(props: {
  labelConfig: IConfig;
  categoryId: string;
  shapeType: string;
}): IConfigValue | undefined {
  const { labelConfig, categoryId, shapeType } = props;
  const shapeConfig = labelConfig[shapeType];

  if (!shapeConfig) return undefined;

  return shapeConfig.values.find((category) => category.id == categoryId);
}
