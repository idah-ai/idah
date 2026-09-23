/** JSON-compatible value persisted in an account-settings JSONB column. */
export type AccountSettingValue =
  | string
  | number
  | boolean
  | null
  | AccountSettingValue[]
  | { [key: string]: AccountSettingValue };
