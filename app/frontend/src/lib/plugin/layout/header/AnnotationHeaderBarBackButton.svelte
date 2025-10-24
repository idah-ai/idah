<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
    import type { IActivityContext } from "@/plugin/interface/Activity";
	import { ArrowLeftIcon } from "@lucide/svelte";

    type Props = {
        context: IActivityContext;
    }

    let {
        context
    }: Props = $props()
</script>

<Button variant="ghost" onclick={context.back}>
	<ArrowLeftIcon class="size-4" />
	Back
</Button>
