
export type PropertyType = 'text' | 'integer' | 'boolean' | 'single-select' | 'multi-select'

// type Property
export type Property = {
  description :string,
  format :any,
  id :string,
  label :string,
  required: boolean
  selector: string[]
  type: PropertyType
}