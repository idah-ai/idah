import type { Icon as IconType } from "@lucide/svelte";
import type { Snippet } from "svelte";
import type { FormEventHandler } from "svelte/elements";

export interface FormFieldBaseProps {
  name: string;

  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;

  prefixIcon?: typeof IconType;
  prefix?: string;
  suffixIcon?: typeof IconType;
  suffix?: string;

  info?: string;
  description?: string;
  errors?: string[];

  class?: string | null;

  slotLabel?: Snippet;
  slotDescription?: Snippet;
  slotInfo?: Snippet;
  slotErrors?: Snippet;
}

export interface InputFieldBaseProps extends FormFieldBaseProps {
  oninput?: FormEventHandler<HTMLInputElement> | null | undefined;
  onblur?: FormEventHandler<HTMLInputElement> | null | undefined;
}
