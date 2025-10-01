import type { Hash } from "@/utils/types";

export interface FormBaseProps {
  fieldErrors: Hash;
  onValueChange: (value: Hash) => void;
}
