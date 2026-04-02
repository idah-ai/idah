import type { AnnotationValue } from "$lib/context/annotation-context";

export function visibilityFullfilled(value: AnnotationValue, field: IConfigProperty) {
  if (typeof field.visibility == "boolean") return field.visibility;
  return new AstProcessor(new Map(objectVariables(value, "value"))).processAST(field.visibility);
}
