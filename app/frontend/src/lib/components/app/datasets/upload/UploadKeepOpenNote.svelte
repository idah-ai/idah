<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import { DialogDescription } from "@/components/ui/dialog";

  // Shown while an upload runs. Browsers only allow their generic "Leave site?" prompt
  // (see upload-leave-guard.svelte.ts), so this says beforehand why leaving matters.
</script>

<DialogDescription class="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
  <TriangleAlertIcon class="size-3.5 shrink-0" />
  Keep this tab open until the upload finishes. Closing or reloading it stops the upload.
</DialogDescription>
