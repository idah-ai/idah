<script lang="ts" generics="T extends Record">
  import AssignedToEmailFilter from "@/components/app/datasets/entries/data-tables/filters/assigned-to-email-filter.svelte";

  import { Record } from "@/data/model/Record";

  import type { DataTableFilterBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { columnSetting, contexts, filters, onFilter }: DataTableFilterBaseProps<T> = $props();
</script>

<!--
  Thin passthrough (kept so `entry-columns.ts` import is stable). Live filtering means the applied
  filter changes on every keystroke, so the previous `{#key filters[...]}` remount was removed — it
  would re-mount the inner and steal focus while typing. The inner re-seeds naturally because this
  filter lives in the column's popover, which unmounts on close and remounts on reopen.
-->
<AssignedToEmailFilter {columnSetting} {contexts} {filters} {onFilter} />
