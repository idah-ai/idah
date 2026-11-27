<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon } from "@lucide/svelte";
  import { slide } from "svelte/transition";

  import DateText from "@/components/app/texts/date-text.svelte";
  import PreFormattedText from "@/components/app/texts/PreFormattedText.svelte";
  import { Button } from "@/components/ui/button";
  import Label from "@/components/ui/label/label.svelte";

  import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: webhookCall }: DataTableCellBaseProps<WebhookCallRecord> = $props();

  // Variables
  let expanded = $state(false);

  function toggleExpanded(): void {
    expanded = !expanded;
  }
</script>

<div class="w-full max-w-full min-w-0 overflow-hidden">
  <div class="flex items-center gap-1">
    <!-- TOGGLE -->
    <Button
      variant="ghost"
      size="icon-sm"
      class="shrink-0"
      onclick={toggleExpanded}
      aria-expanded={expanded}
      aria-label="Toggle delivery response"
    >
      {#if expanded}
        <ChevronDownIcon />
      {:else}
        <ChevronRightIcon />
      {/if}
    </Button>

    <!-- CREATED AT -->
    <div class="flex min-w-0 items-center">
      <DateText
        datetime={webhookCall.created_at}
        datetimeFormat="MMM dd, yyyy HH:mm:ss aa"
        class="text-muted-foreground text-sm"
      />
    </div>
  </div>

  {#if expanded}
    <div transition:slide class="mt-3 flex max-w-full min-w-0 flex-col gap-2 pl-8 whitespace-normal">
      <Label class="text-muted-foreground text-sm font-semibold">Response</Label>

      <div class="max-h-[40vh] max-w-full min-w-0 overflow-auto">
        <PreFormattedText>
          {webhookCall.response || webhookCall.error || "-"}
        </PreFormattedText>
      </div>
    </div>
  {/if}
</div>
