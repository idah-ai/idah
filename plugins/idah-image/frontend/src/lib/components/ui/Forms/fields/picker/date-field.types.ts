import type { FormFieldBaseProps } from "$lib/components/ui/Forms/form-field.types";

export interface DateFieldBaseProps extends FormFieldBaseProps {
	placeholderDateFormat?: string;
	dateStyle?: "full" | "long" | "medium" | "short" | undefined;
	onDateSelected?: (formattedDate: string | null) => Promise<void> | void;
}
