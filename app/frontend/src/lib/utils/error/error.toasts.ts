import { errorClasses } from "$lib/utils/error/error.classes";
import { showToast } from "@/components/ui/toast/index.svelte";

import type { ErrorClassDetail } from "$lib/utils/error/error.classes.types";
import type { Hash } from "$lib/utils/types";

type ErrorToastOptions = {
  title?: string;
  message?: string;
  error?: Hash;
};

export function showErrorToast(errorToastOptions: ErrorToastOptions) {
  const { title, message } = errorToastOptions;

  const fallbackTitle: string = "Sorry, something went wrong!";
  const fallbackMessage: string = "Please try again later.";

  const errorClass: ErrorClassDetail | null = title ? errorClasses[title] : null;
  const errorClassTitle: string = errorClass ? errorClass.title : fallbackTitle;
  const errorClassMessage: string = message ? message : errorClass?.fallbackMessage || fallbackMessage;

  showToast.error({
    title: errorClassTitle,
    description: errorClassMessage,
  });
}

export function showActionFailedToast(error: unknown) {
  console.error(error);

  showToast.error({
    title: "Action failed",
    description:
      "The action could not be completed, please try again later. If the problem continues, please contact support.",
  });
}
