<script lang="ts">
	import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

	// Props
	interface Props {
		title: string;
		value: string | number;
	}
	let { title, value }: Props = $props();
</script>

<Card>
	<CardHeader>
		<CardDescription>{title}</CardDescription>
		<CardTitle class="text-2xl">{value}</CardTitle>
	</CardHeader>
</Card>
