<script lang="ts">
  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import Copyable from "@/components/app/texts/copyable.svelte";
  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  // Props
  let { record: apiKeyRecord }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Variables
  let { api_key } = $derived(apiKeyRecord);
</script>

<Copyable title="API Key" value={api_key as string}></Copyable>
