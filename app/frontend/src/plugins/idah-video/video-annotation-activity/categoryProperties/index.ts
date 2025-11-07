import type { AnnotationValue } from "@/context/AnnotationContext";
import type { IConfigProperty, IConfigPropertyFormat, IConfigPropertyOption } from "@/plugin/interface/Activity";
import { AstProcessor, objectVariables } from "../../test_ast_resolution";

export function visibilityFullfilled(value: AnnotationValue, field: IConfigProperty) {
  console.debug({ value, field, variables: objectVariables(value, "annotation.value") });
  if (typeof field.visibility == "boolean") return field.visibility;
  return new AstProcessor(new Map(objectVariables(value, "annotation.value"))).processAST(field.visibility);
}

export function requiredFullfilled(value: AnnotationValue, properties: IConfigProperty[]): boolean {
  return properties
    .filter((p) => visibilityFullfilled(value, p) && p.required)
    .every((p) => value.attributes?.[p.id] != undefined && conformToformat(value.attributes?.[p.id], p));
}

export function propertyFullfilled(value: string | number | string[] | boolean | undefined, property: IConfigProperty) {
  return property.required
    ? value != undefined && conformToformat(value, property)
    : value == undefined || conformToformat(value, property);
}

const formatValidators = [
  {
    type: "text",
    minimum: (v: string, format: IConfigPropertyFormat) => v?.length >= (format.minimum || 0),
    maximum: (v: string, format: IConfigPropertyFormat) => v?.length <= (format.maximum || v?.length || 0),
    step: (_v: string, _format: IConfigPropertyFormat) => true,
    options: (_v: string, _format: IConfigPropertyFormat) => true,
    info: (_v: string) => true,
  },
  {
    type: "integer",
    minimum: (v: number, format: IConfigPropertyFormat) => v >= (format.minimum || 0),
    maximum: (v: number, format: IConfigPropertyFormat) => v <= (format.maximum || v),
    step: (v: number, format: IConfigPropertyFormat) =>
      !((v - (format.minimum || 0)) % (format.step || 1)) || v == format.maximum,
    options: (_v: number, _format: IConfigPropertyFormat) => true,
    info: (_v: number) => true,
  },
  {
    type: "boolean",
    minimum: (_v: boolean, _format: IConfigPropertyFormat) => true,
    maximum: (_v: boolean, _format: IConfigPropertyFormat) => true,
    step: (_v: boolean, _format: IConfigPropertyFormat) => true,
    options: (_v: boolean, _format: IConfigPropertyFormat) => true,
    info: (_v: boolean) => true,
  },
  {
    type: "single-select",
    minimum: (_v: string, _format: IConfigPropertyFormat) => true,
    maximum: (_v: string, _format: IConfigPropertyFormat) => true,
    step: (_v: string, _format: IConfigPropertyFormat) => true,
    options: (v: string, format: IConfigPropertyFormat) => format.options?.map((o) => o.id).includes(v),
    info: (_v: string) => true,
  },
  {
    type: "multi-select",
    minimum: (v: string[], format: IConfigPropertyFormat) => v?.length >= (format.minimum || 0),
    maximum: (v: string[], format: IConfigPropertyFormat) =>
      v?.length <= (format.maximum || format.options.length || 0),
    step: (_v: string[], _format: IConfigPropertyFormat) => true,
    options: (v: string[], format: IConfigPropertyFormat) => {
      const optionIds = format.options?.map((o) => o.id);
      return v?.every((s) => optionIds?.includes(s));
    },
    info: (_v: string[]) => true,
  },
];

function conformToformat(
  value: string | number | string[] | boolean | undefined,
  propertyField: IConfigProperty,
): boolean {
  const validator = formatValidators.find((f) => f.type == propertyField.type);

  if (!validator) return false;

  return Object.entries(propertyField.format)
    .filter(([k, _]) => k != "type")
    .every(([k, _v]: [k: string, _v: string | number | Array<IConfigPropertyOption>]) => {
      return validator[k](value, propertyField.format);
    });
}

export function formatConformity(
  value: string | number | string[] | boolean | undefined,
  propertyField: IConfigProperty,
) {
  const validator = formatValidators.find((f) => f.type == propertyField.type);

  return [
    [["required", propertyField.required], propertyField.required ? value != undefined : true],
    ...Object.entries(propertyField.format)
      .filter(([k, _]) => k != "type")
      .map(([k, _]) => [
        [k, k == "options" ? propertyField.format[k].map((o) => o.label) : propertyField.format[k]],
        !validator ? false : validator[k](value, propertyField.format),
      ]),
  ]
    .filter(([_, b]) => !b)
    .map(([a, _]) => a);
}
