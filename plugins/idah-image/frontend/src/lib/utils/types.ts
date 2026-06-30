export type Hash = Record<string, unknown>;

export interface LabelValue<Value = string> {
  label: string;
  value: Value;
}
