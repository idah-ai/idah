import type { Icon as IconType } from "@lucide/svelte";
import type { Snippet } from "svelte";
import type { FormEventHandler } from "svelte/elements";

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

export interface NumberFieldBaseProps extends FormFieldBaseProps {
  inputmode?: "decimal" | "numeric" | "tel"; // default: "decimal"
  min?: number;
  max?: number;
  step?: number;
  oninput?: FormEventHandler<HTMLInputElement> | null | undefined;
  onblur?: FormEventHandler<HTMLInputElement> | null | undefined;
}

export interface TextAreaFieldBaseProps extends FormFieldBaseProps {
  rows?: number;
  oninput?: FormEventHandler<HTMLTextAreaElement> | null | undefined;
  onblur?: FormEventHandler<HTMLTextAreaElement> | null | undefined;
}

export interface SelectFieldBaseProps extends FormFieldBaseProps {
  choices: LabelValue<string | number>[];
  hiddenChoices?: Array<string | number>;
  disabledChoices?: Array<string | number>;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  clearable?: boolean;
  slotChoice?: Snippet<
    [
      {
        choice: LabelValue<string | number>;
        select: (choice: LabelValue<string | number>) => Promise<void> | void;
      },
    ]
  >;
}

export interface SingleSelectFieldBaseProps extends SelectFieldBaseProps {
  onSelected?: (value: string | number) => Promise<void> | void;
  slotTrigger?: Snippet<
    [
      {
        selectedChoice: LabelValue<string | number> | undefined;
        clearable: boolean;
        disabled: boolean;
      },
    ]
  >;
  slotTriggerValue?: Snippet<
    [
      {
        selectedChoice: LabelValue<string | number> | undefined;
      },
    ]
  >;
}

export interface MultipleSelectFieldBaseProps extends SelectFieldBaseProps {
  closeOnSelect?: boolean;
  onSelected?: (selectedChoices: LabelValue<string | number>[]) => Promise<void> | void;
  slotTrigger?: Snippet<
    [
      {
        selectedChoices: LabelValue<string | number>[] | undefined;
        clearable: boolean;
        disabled: boolean;
      },
    ]
  >;
  slotTriggerValues?: Snippet<
    [
      {
        selectedChoices: LabelValue<string | number>[];
      },
    ]
  >;
}

export interface SelectDataSourceFieldBaseProps<T extends Record> extends Omit<SelectFieldBaseProps, "choices"> {
  displayKey: keyof T;
  valueKey?: keyof T;
  dataSource: DataSource<T>;
  listOptions?: ListOptions;
  searchKeyWithOperation: string;
}

export interface SingleSelectDataSourceFieldBaseProps<T extends Record>
  extends Omit<SingleSelectFieldBaseProps, "choices">,
    SelectDataSourceFieldBaseProps<T> {}

export interface MultipleSelectDataSourceFieldBaseProps<T extends Record>
  extends Omit<MultipleSelectFieldBaseProps, "choices">,
    SelectDataSourceFieldBaseProps<T> {}
