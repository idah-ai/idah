import type { ModalBaseProps } from "$lib/components/app/overlays/modals/Modal.types";
import type { Snippet } from "svelte";

export type FormModalAction = "create" | "update";

export interface FormModalBaseProps extends ModalBaseProps {
	action: FormModalAction;
	title: string;
	description?: string;
	loading?: boolean;
	actions?: Snippet;
	confirm?: Snippet;
	onCancel?: () => Promise<void> | void;
	onConfirm?: () => Promise<void> | void;
}
