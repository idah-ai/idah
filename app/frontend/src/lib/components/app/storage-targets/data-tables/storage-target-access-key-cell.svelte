<script lang="ts">
  import { EyeIcon, EyeOffIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";

  import { StorageTargetRecord } from "@/data/model/setting/storage_target/record";
  import { maskedAccessKeyId } from "@/data/model/setting/storage_target/utils";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: target }: DataTableCellBaseProps<StorageTargetRecord> = $props();

  // Variables
  // The access key ID is the key's name, not a secret, but stays hidden until asked for. Nothing of the secret
  // key ever reaches the browser.
  let revealed: boolean = $state(false);
</script>

<div class="flex items-center gap-1">
  <span class="font-mono text-sm">{revealed ? target.access_key_id : maskedAccessKeyId(target.access_key_id)}</span>

  <Button
    variant="ghost"
    size="icon-xs"
    class="text-muted-foreground hover:text-foreground"
    aria-label={revealed ? "Hide the access key ID" : "Show the access key ID"}
    aria-pressed={revealed}
    title={revealed ? "Hide the access key ID" : "Show the access key ID"}
    onclick={(event: MouseEvent) => {
      event.stopPropagation();
      revealed = !revealed;
    }}
  >
    {#if revealed}
      <EyeOffIcon />
    {:else}
      <EyeIcon />
    {/if}
  </Button>
</div>
