import type { AnnotationValue } from "@/context/AnnotationContext"
import type { PropertyField } from "@/plugin/interface/Activity"

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

      return value.attributes?.[p.id] != undefined && conformToformat(value, p)
    })
  }


  function conformToformat(
    value: AnnotationValue, propertyField: PropertyField
  ): boolean {
    return true
  }