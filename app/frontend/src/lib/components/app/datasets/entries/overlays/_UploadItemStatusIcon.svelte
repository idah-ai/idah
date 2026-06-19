<script lang="ts">
  import ErrorIcon from "./_ErrorIcon.svg";
  import SuccessIcon from "./_SuccessIcon.svg";
  import WarningIcon from "./_WarningIcon.svg";

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
  <img src={SuccessIcon} alt="Success" class="size-5 shrink-0" />
{:else if icon === "warning"}
  <img src={WarningIcon} alt="Warning" class="size-5 shrink-0" />
{:else if icon === "error"}
  <img src={ErrorIcon} alt="Error" class="size-5 shrink-0" />
{/if}
