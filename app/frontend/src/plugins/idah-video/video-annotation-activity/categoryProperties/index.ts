import type { AnnotationValue } from "@/context/AnnotationContext";
import type { LabelPropertyOption, PropertyField } from "@/plugin/interface/Activity";

export function visibleFullfilled(value: AnnotationValue, p: PropertyField) {
  // check visibility condition
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

export function propertyFullfilled(value: any, property: PropertyField) {
  return property.required
    ? value != undefined && conformToformat(value, property)
    : value == undefined || conformToformat(value, property);
}

const formatValidators = [
  {
    type: "text",
    minimum: (v: string, format) => v?.length >= (format.minimum || 0),
    maximum: (v: string, format) => v?.length <= (format.maximum || v.length),
    step: (v: string, format) => true,
    options: (v: string, format) => true,
    info: (v) => true,
  },
  {
    type: "integer",
    minimum: (v: number, format) => v >= (format.minimun || 0),
    maximum: (v: number, format) => v <= (format.maximum || v),
    step: (v: number, format) => !((v - format.minimum) % format.step) || v == format.maximum,
    options: (v: number, format) => true,
    info: (v) => true,
  },
  {
    type: "boolean",
    minimum: (v: number, format) => true,
    maximum: (v: number, format) => true,
    step: (v: number, format) => true,
    options: (v: number, format) => true,
    info: (v) => true,
  },
  {
    type: "single-select",
    minimum: (v: string, format) => true,
    maximum: (v: string, format) => true,
    step: (v: string, format) => true,
    options: (v: string, format) => format.options.map((o) => o.id).includes(v),
    info: (v) => true,
  },
  {
    type: "multi-select",
    minimum: (v: string[], format) => v.length >= format.minimun,
    maximum: (v: string[], format) => v.length <= format.maximum,
    step: (v: string[], format) => true,
    options: (v: string[], format) => {
      const optionIds = format.options.map((o) => o.id);
      return v.every((s) => optionIds.includes(s));
    },
    info: (v) => true,
  },
];

function conformToformat(value: any, propertyField: PropertyField): boolean {
  const validator = formatValidators.find((f) => f.type == propertyField.type);

  if (!validator) return false;

  return Object.entries(propertyField.format)
    .filter(([k, _]) => k != "type")
    .every(([k, v]) => {
      return validator[k](value, propertyField.format);
    });
}

export function formatConformity(value: any, propertyField: PropertyField) {
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
