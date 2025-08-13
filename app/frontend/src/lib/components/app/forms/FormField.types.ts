import type { Snippet } from "svelte";

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
