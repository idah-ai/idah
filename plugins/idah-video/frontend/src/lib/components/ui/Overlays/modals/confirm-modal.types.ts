import type { Snippet } from "svelte";

import type { ModalBaseProps } from "$lib/components/ui/Overlays/modals/Modal.types";

export interface ConfirmModalBaseProps extends ModalBaseProps {
  title: string;
  description: string;
  confirm?: Snippet;
  confirmLabel?: string;
  onCancel?: () => Promise<void> | void;
  onConfirm?: () => Promise<void> | void;
}
