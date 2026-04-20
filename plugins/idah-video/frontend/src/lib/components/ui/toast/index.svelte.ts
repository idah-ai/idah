import CustomToast from "$lib/components/ui/toast/custom-toast.svelte";

import { toast } from "svelte-sonner";

export type CustomToastType = "default" | "info" | "success" | "warning" | "error";

export interface CustomToastOptions {
  id?: string | number;
  type?: CustomToastType;

  title: string;
  description?: string;

  dismissable?: boolean; // default: false
}

function getRandomUUID(): string {
  return crypto.randomUUID();
}

export const showToast = {
  default: (toastOptions: CustomToastOptions) => {
    const id = getRandomUUID();
    toast(CustomToast, {
      id,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "default",
        },
      },
    });
  },
  success: (toastOptions: CustomToastOptions) => {
    const id = getRandomUUID();
    toast.success(CustomToast, {
      id,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "success",
        },
      },
    });
  },
  info: (toastOptions: CustomToastOptions) => {
    const id = getRandomUUID();
    toast.info(CustomToast, {
      id,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "info",
        },
      },
    });
  },
  warning: (toastOptions: CustomToastOptions) => {
    const id = getRandomUUID();
    toast.warning(CustomToast, {
      id,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "warning",
        },
      },
    });
  },
  error: (toastOptions: CustomToastOptions) => {
    const id = getRandomUUID();
    toast.error(CustomToast, {
      id,
      componentProps: {
        toastOptions: {
          ...toastOptions,
          id,
          type: "error",
        },
      },
    });
  },
};
