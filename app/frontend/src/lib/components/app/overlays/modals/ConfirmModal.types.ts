import type { ModalBaseProps } from "$lib/components/app/overlays/modals/Modal.types";
import type { Snippet } from "svelte";

export interface ConfirmModalBaseProps extends ModalBaseProps {
	title: string;
	description: string;
	confirm?: Snippet;
	confirmLabel?: string;
	onCancel?: () => Promise<void> | void;
	onConfirm?: () => Promise<void> | void;
}
