import type { AnnotationValue } from "@/context/AnnotationContext"
import type { LabelPropertyOption, PropertyField } from "@/plugin/interface/Activity"

  export function visibleFullfilled(value: AnnotationValue, p: PropertyField) {
    // check visibility condition
    return true
  }

  export function requiredFullfilled(
    value:AnnotationValue, properties: PropertyField[]
  ):boolean {
    // todo account for visibility/required

    const required_properties =
      properties.filter(
        p => p.required && value.category && p.selector.includes(value.category)
      )

    return value.category != undefined && // for now enforce category
      required_properties.every(p => {

      return value.attributes?.[p.id] != undefined && conformToformat(value.attributes?.[p.id], p)
    })
  }

const formatValidators = [
  {
    type: "text",
    minimum: (v: string, format) => v.length >= format.minimum,
    maximum: (v: string, format) => v.length <= format.maximum,
    step: (v: string, format) => true
    options: (v: string, options: Array<LabelPropertyOption>) => true
    info: (v) => true
  }, {
    type: "integer",
    minimum: (v: number, format) => v >= (format.minimun || 0),
    maximum: (v: number, format) => v <= (format.maxximum || v),
    step: (v: number, format) => {
      return !((v - format.minimum) % format.step) || v == format.maximum
    },
    options: (v: number, options: Array<LabelPropertyOption>) => true,
    info: (v) => true
  }, {
    type: "boolean",
    minimum: (v: number, format) => true,
    maximum: (v: number, format) => true,
    step: (v: number, format) => true,
    options: (v: number, format) => true,
    info: (v) => true
  }, {
    type: "single-select",
    minimum: (v: string, format) => true,
    maximum: (v: string, format) => true,
    step: (v: string, format) => true,
    options: (v: string, format) =>
      format.options.map(o => o.id).includes(v),
    info: (v) => true
  }, {
    type: "multi-select",
    minimum: (v: string[], format) => v.length >= format.minimun,
    maximum: (v: string[], format) => v.length <= format.maximum,
    step: (v: string[], format) => true,
    options: (v: string[], format) => {
      const optionIds = format.options.map(o => o.id)
      return v.every(s => optionIds.includes(s))
    },
    info: (v) => true
  }
]


  function conformToformat(
    value: any, propertyField: PropertyField
  ): boolean {

    const validator = formatValidators.find(f => f.type == propertyField.type)

    if (!validator) return false

    return Object.entries(propertyField.format).filter(([k, _]) => k != 'type').every(([k, v]) => {
      return validator[k](value, propertyField.format)
    })
  }