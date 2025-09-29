import type { Snippet } from "svelte";
import type { LabelValue } from "@/utils/types";
import type { DataSource, ListOptions } from "@/data/DataSource";
import type { Record } from "@/data/model/Record";

export interface FormFieldBaseProps {
  name: string;

  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;

  info?: string;
  errors?: string[];

  class?: string | null;

  slotLabel?: Snippet;
  slotInfo?: Snippet;
  slotErrors?: Snippet;
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
  dataSource: DataSource<T>;
  listOptions?: ListOptions;
}
