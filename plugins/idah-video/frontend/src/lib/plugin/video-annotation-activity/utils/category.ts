import type { IConfig, IConfigValue } from "$idah/v2/types";

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
