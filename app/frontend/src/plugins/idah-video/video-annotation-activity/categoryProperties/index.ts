import type { AnnotationValue } from "@/context/AnnotationContext";
import type { FieldFormat, LabelPropertyOption, PropertyField } from "@/plugin/interface/Activity";

export function visibleFullfilled(value: AnnotationValue, field?: PropertyField) {
  // check visibility condition
  console.debug({ value, field });
  return true;
}

export function requiredFullfilled(value: AnnotationValue, properties: PropertyField[]): boolean {
  // todo account for visibility/required

  const required_properties = properties.filter(
    (p) => p.required && value.category && matchSelector(p.selector, value.category),
  );

  return (
    value.category != undefined && // for now enforce category
    required_properties.every((p) => {
      return value.attributes?.[p.id] != undefined && conformToformat(value.attributes?.[p.id], p);
    })
  );
}

function matchSelector(selector: string[], selection: string) {
  selector.some((select) => {
    const parts = select.split("*");
    let s = selection;
    parts.every((part) => {
      const split = s.split(part, 1);
      if (split.length != 2) return false;
      s = split[1];
      return true;
    });
  });
}

export function propertyFullfilled(value: string | number | string[] | boolean | undefined, property: PropertyField) {
  return property.required
    ? value != undefined && conformToformat(value, property)
    : value == undefined || conformToformat(value, property);
}

const formatValidators = [
  {
    type: "text",
    minimum: (v: string, format: FieldFormat) => v?.length >= (format.minimum || 0),
    maximum: (v: string, format: FieldFormat) => v?.length <= (format.maximum || v.length),
    step: (_v: string, _format: FieldFormat) => true,
    options: (_v: string, _format: FieldFormat) => true,
    info: (_v: string) => true,
  },
  {
    type: "integer",
    minimum: (v: number, format: FieldFormat) => v >= (format.minimum || 0),
    maximum: (v: number, format: FieldFormat) => v <= (format.maximum || v),
    step: (v: number, format: FieldFormat) =>
      !((v - (format.minimum || 0)) % (format.step || 1)) || v == format.maximum,
    options: (_v: number, _format: FieldFormat) => true,
    info: (_v: number) => true,
  },
  {
    type: "boolean",
    minimum: (_v: boolean, _format: FieldFormat) => true,
    maximum: (_v: boolean, _format: FieldFormat) => true,
    step: (_v: boolean, _format: FieldFormat) => true,
    options: (_v: boolean, _format: FieldFormat) => true,
    info: (_v: boolean) => true,
  },
  {
    type: "single-select",
    minimum: (_v: string, _format: FieldFormat) => true,
    maximum: (_v: string, _format: FieldFormat) => true,
    step: (_v: string, _format: FieldFormat) => true,
    options: (v: string, format: FieldFormat) => format.options.map((o) => o.id).includes(v),
    info: (_v: string) => true,
  },
  {
    type: "multi-select",
    minimum: (v: string[], format: FieldFormat) => v.length >= (format.minimum || 0),
    maximum: (v: string[], format: FieldFormat) => v.length <= (format.maximum || format.options.length || 0),
    step: (_v: string[], _format: FieldFormat) => true,
    options: (v: string[], format: FieldFormat) => {
      const optionIds = format.options.map((o) => o.id);
      return v.every((s) => optionIds.includes(s));
    },
    info: (_v: string[]) => true,
  },
];

function conformToformat(
  value: string | number | string[] | boolean | undefined,
  propertyField: PropertyField,
): boolean {
  const validator = formatValidators.find((f) => f.type == propertyField.type);

  if (!validator) return false;

  return Object.entries(propertyField.format)
    .filter(([k, _]) => k != "type")
    .every(([k, _v]: [k: string, _v: string | number | Array<LabelPropertyOption>]) => {
      return validator[k](value, propertyField.format);
    });
}

export function formatConformity(
  value: string | number | string[] | boolean | undefined,
  propertyField: PropertyField,
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
