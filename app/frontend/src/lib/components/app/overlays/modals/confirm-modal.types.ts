import type { Snippet } from "svelte";

import type { ModalBaseProps } from "@/components/app/overlays/modals/Modal.types";

export interface ConfirmModalBaseProps extends ModalBaseProps {
  title: string;
  description: string;
  confirm?: Snippet;
  confirmLabel?: string;
  onCancel?: () => Promise<void> | void;
  onConfirm?: () => Promise<void> | void;
}
