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
    const required_properties = properties.filter(p => p.required)

    return required_properties.every(p => {
      !!value.attributes?.[p.id] && conformToformat(value, p)
    })
  }


  function conformToformat(
    value: AnnotationValue, propertyField: PropertyField
  ): boolean {
    true
  }