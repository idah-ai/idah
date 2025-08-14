import type { FormFieldBaseProps } from "$/lib/components/app/forms/FormField.types";

export interface DateFieldBaseProps extends FormFieldBaseProps {
	placeholderDateFormat?: string;
	dateStyle?: "full" | "long" | "medium" | "short" | undefined;
	onDateSelected?: (formattedDate: string | null) => Promise<void> | void;
}
