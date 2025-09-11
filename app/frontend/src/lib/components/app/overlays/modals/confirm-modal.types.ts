import type { ModalBaseProps } from "@/components/app/overlays/modals/modal.types";
import type { Snippet } from "svelte";

export interface ConfirmModalBaseProps extends ModalBaseProps {
	title: string;
	description: string;
	confirm?: Snippet;
	confirmLabel?: string;
	onCancel?: () => Promise<void> | void;
	onConfirm?: () => Promise<void> | void;
}
