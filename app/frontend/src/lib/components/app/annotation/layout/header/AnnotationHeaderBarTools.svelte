<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import CommandManager from "@/command/CommandManager";
	import Separator from "@/components/ui/separator/separator.svelte";
	import { MousePointer2, RedoIcon, UndoIcon, BoxSelectIcon } from "@lucide/svelte";
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

	import type { AnnotationHeaderBarBaseTool } from "@/components/app/annotation/layout/header/AnnotationHeaderBar.types";
	import type { VideoMode } from "@/components/video-annotation-activity/VideoAnnotationContext";

	// Props
	interface Props {
		mode: VideoMode;
		onSelectMode: (selectedMode: VideoMode) => void;
	}
	let { mode = $bindable(), onSelectMode }: Props = $props();

	// Variables
	interface HeaderBarModeTool extends AnnotationHeaderBarBaseTool {
		type: VideoMode;
	}

	const tools: HeaderBarModeTool[] = [
		{
			label: "View",
			type: "view",
			icon: MousePointer2,
			handleClick: () => {
				mode = "view";
				onSelectMode("view");
			},
		},
		{
			label: "Bounding Box",
			type: "bounding-box",
			icon: BoxSelectIcon,
			handleClick: () => {
				mode = "bounding-box";
				onSelectMode("bounding-box");
			},
		},
	];

	const commands: AnnotationHeaderBarBaseTool[] = [
		{
			label: "Undo",
			icon: UndoIcon,
			handleClick: () => {
				CommandManager.undo();
			},
		},
		{
			label: "Redo",
			icon: RedoIcon,
			handleClick: () => {
				CommandManager.redo();
			},
		},
	];
</script>

<div id="annotation-header-bar-tools" class="flex h-full items-center gap-1">
	{#each tools as { label, type, icon: Icon, handleClick }}
		<TooltipProvider>
			<Tooltip delayDuration={100}>
				<TooltipTrigger>
					<Button variant={mode === type ? "default" : "ghost"} size="icon" onclick={handleClick}>
						<Icon class="size-4" />
					</Button>
				</TooltipTrigger>

				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	{/each}

	<Separator orientation="vertical" />

	{#each commands as { label, icon: Icon, handleClick }}
		<TooltipProvider>
			<Tooltip delayDuration={100}>
				<TooltipTrigger>
					<Button variant="ghost" size="icon" onclick={handleClick}>
						<Icon class="size-4" />
					</Button>
				</TooltipTrigger>

				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	{/each}
</div>
