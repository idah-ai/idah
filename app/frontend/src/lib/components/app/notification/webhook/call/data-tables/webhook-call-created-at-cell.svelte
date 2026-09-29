<script lang="ts">
  import { Icon } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  
  import DateText from "@/components/app/texts/date-text.svelte";
  import PreFormattedText from "@/components/app/texts/pre-formatted-text.svelte";
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

<div class="w-full min-w-[40vw]">
  <div class="flex items-center gap-1">
    <!-- TOGGLE -->
    <Button variant="ghost" size="icon-sm" onclick={toggleExpanded}>
      <Icon name={expanded ? "chevron-down" : "chevron-right"} />
    </Button>

    <!-- CREATED AT -->
    <div class="gap- flex items-center">
      <DateText datetime={webhookCall.created_at} datetimeFormat="MMM dd, yyyy HH:mm:ss aa" />
    </div>
  </div>

  {#if expanded}
    <div transition:slide class="flex w-full flex-col gap-2">
      <Label>Response</Label>

      <div class="h-full max-h-[40vh] overflow-y-auto pr-3">
        <PreFormattedText>
          {webhookCall.body}
        </PreFormattedText>
      </div>
    </div>
  {/if}
</div>
