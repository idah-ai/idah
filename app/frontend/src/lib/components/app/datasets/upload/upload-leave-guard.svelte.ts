import { beforeNavigate } from "$app/navigation";

import { showToast } from "@/components/ui/toast/index.svelte";

// Keeps the user on the page while an upload runs: leaving would stop it halfway, with
// some files uploaded and the rest not. Call it while a component initialises.
// - Closing the tab, reloading or typing another address: the browser asks to confirm
//   (browsers only allow their own generic message).
// - In-app navigation (the Back button; the open modal blocks the rest): refused, with a toast.
export function guardLeavingDuringUpload(isUploading: () => boolean): void {
  beforeNavigate((navigation) => {
    if (!isUploading() || navigation.willUnload) return; // unloading is left to beforeunload
    navigation.cancel();
    showToast.warning({ title: "Upload in progress", description: "Wait for it to finish before leaving." });
  });

  $effect(() => {
    if (!isUploading()) return;
    const confirmLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", confirmLeaving);
    return () => window.removeEventListener("beforeunload", confirmLeaving);
  });
}
