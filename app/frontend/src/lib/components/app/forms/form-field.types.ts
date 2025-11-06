import type { Icon as IconType } from "@lucide/svelte";
import type { Snippet } from "svelte";
import type { FormEventHandler, HTMLInputTypeAttribute } from "svelte/elements";

import type { DataSource, ListOptions } from "@/data/DataSource";
import type { Record } from "@/data/model/Record";
import type { LabelValue } from "@/utils/types";

export interface FormFieldBaseProps {
  name: string;

  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;

  info?: string;
  description?: string;
  errors?: string[];

  class?: string | null;

  slotDescription?: Snippet;
  slotErrors?: Snippet;
}

export interface InputFieldBaseProps extends FormFieldBaseProps {
  type?: HTMLInputTypeAttribute;
  prefixIcon?: typeof IconType;
  prefix?: string;
  suffixIcon?: typeof IconType;
  suffix?: string;
  oninput?: FormEventHandler<HTMLInputElement> | null | undefined;
  onblur?: FormEventHandler<HTMLInputElement> | null | undefined;
}

export interface SelectFieldBaseProps extends FormFieldBaseProps {
  choices: LabelValue<string | number>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  clearable?: boolean;

  onValueChange?: (value: string | number) => Promise<void> | void;

  slotTrigger?: Snippet<
    [
      {
        selectedChoice: LabelValue<string | number> | undefined;
        clearable: boolean;
        disabled: boolean;
      },
    ]
  >;
  slotChoice?: Snippet<[{ choice: LabelValue<string | number> }]>;
}

export interface SelectDataSourceFieldBaseProps<T extends Record> extends Omit<SelectFieldBaseProps, "choices"> {
  displayKey: keyof T;
  valueKey?: keyof T;
  dataSource: DataSource<T>;
  listOptions?: ListOptions;
  searchKeyWithOperation: string;
}
