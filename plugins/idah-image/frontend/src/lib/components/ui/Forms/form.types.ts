import type { Hash } from "$lib/utils/types";

export interface FormBaseProps {
  fieldErrors: Hash;
  onValueChange: (value: Hash) => void;
}
