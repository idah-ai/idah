<script lang="ts">
	import type { MultipleSelectBaseProps } from "@/components/ui/select/select.types"
	
let {
    label,
    placeholder,
    required = false,
    values = [],
    error,
    choices = [],
    searchPlaceholder = "Search...",
    clearable = false,
  } : MultipleSelectBaseProps = $props();
</script>
