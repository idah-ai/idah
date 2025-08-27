import type { Snippet } from "svelte";
import type { LabelValue } from "@/components/app/ComponentApp.types";

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
	choices: LabelValue<string>[];
	searchable?: boolean;
	searchPlaceholder?: string;
	clearable?: boolean;
}
