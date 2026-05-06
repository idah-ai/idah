import { AstProcessor, objectVariables } from "$lib/plugin/test_ast_resolution";

import type { AnnotationValue } from "$lib/context/annotation-context";
import type { IConfigProperty } from "$lib/context/context";

export function visibilityFullfilled(value: AnnotationValue, field: IConfigProperty) {
  if (typeof field.visibility == "boolean") return field.visibility;
  return new AstProcessor(new Map(objectVariables(value, "value"))).processAST(field.visibility);
}
