<script lang="ts">
  interface Props {
    isZip: boolean;
    totalUploaded: number;
    totalSkipped: number;
    totalErrors: number;
    status: string;
  }
  let { isZip, totalUploaded, totalSkipped, totalErrors, status }: Props = $props();

  const icon = $derived.by<"success" | "warning" | "error" | null>(() => {
    if (status !== "completed") return null;

    if (!isZip) {
      // Non-zip: success if uploaded > 0, otherwise error
      return totalUploaded > 0 ? "success" : "error";
    }

    // Zip logic
    const success = totalUploaded > 0;
    const partial = totalSkipped > 0 || totalErrors > 0;

    if (success && !partial) return "success";
    if (success && partial) return "warning";
    return "error";
  });
</script>

{#if icon === "success"}
  <img src="/assets/icons/SuccessIcon.svg" alt="Success" class="size-5 shrink-0" />
{:else if icon === "warning"}
  <img src="/assets/icons/WarningIcon.svg" alt="Warning" class="size-5 shrink-0" />
{:else if icon === "error"}
  <img src="/assets/icons/ErrorIcon.svg" alt="Error" class="size-5 shrink-0" />
{/if}
