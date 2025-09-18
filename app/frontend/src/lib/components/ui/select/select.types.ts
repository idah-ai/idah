import type { SelectFieldBaseProps } from "@/components/app/forms/form-field.types";

export interface SelectBaseProps extends SelectFieldBaseProps {
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string | string[];
}

export interface SingleSelectBaseProps extends SelectBaseProps {
  value?: string | number | null;
}

export interface MultipleSelectBaseProps extends SelectBaseProps {
  values?: Array<string | number | null>;
}
