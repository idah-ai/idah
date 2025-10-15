import type { Snippet } from "svelte";

import type { ModalBaseProps } from "@/components/app/overlays/modals/Modal.types";

export type FormModalAction = "create" | "update";

export interface FormModalBaseProps extends ModalBaseProps {
  action: FormModalAction;
  title?: string;
  description?: string;
  loading?: boolean;
  actions?: Snippet;
  confirm?: Snippet;
  onCancel?: () => Promise<void> | void;
  onConfirm?: () => Promise<void> | void;
}
