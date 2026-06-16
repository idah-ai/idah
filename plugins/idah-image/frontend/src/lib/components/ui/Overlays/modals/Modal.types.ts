import type { Snippet } from "svelte";

export interface ModalBaseProps {
	open: boolean;
	modalTitle?: Snippet;
	modalDescription?: Snippet;
	children?: Snippet;
}
