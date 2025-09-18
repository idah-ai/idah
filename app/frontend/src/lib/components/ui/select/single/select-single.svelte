<script lang="ts">
    import type { SingleSelectBaseProps } from  "@/components/ui/select/select.types"


let {
    label,
    placeholder,
    required = false,
    value = $bindable(null),
    error,
    choices = [],
    searchPlaceholder = "Search...",
    clearable = false,
  } : SingleSelectBaseProps = $props();
</script>
