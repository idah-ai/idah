<script lang="ts">
  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import Label from "@/components/ui/label/label.svelte";
  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  // Props
  let { record: apiKeyRecord }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Variables
  let { key_label } = $derived(apiKeyRecord);
</script>

<Label>{key_label}</Label>
