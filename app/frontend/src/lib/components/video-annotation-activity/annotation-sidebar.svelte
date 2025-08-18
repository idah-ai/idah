<script lang="ts">
	import CategoriesSelection from "@/components/video-annotation-activity/categories-selection.svelte";
	import Input from "@/components/ui/input/input.svelte";
	import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

	import type { AnnotationValue } from "$lib/context/AnnotationContext";
	import type { ToolInfo } from "@/context/ActivityContext";
	import {
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarHeader,
		SidebarMenuButton,
		SidebarMenuItem,
	} from "../ui/sidebar";
	import type { VideoAnnotation, VideoMode } from "@/components/video-annotation-activity/VideoAnnotationContext";
	let {
		annotationValue,
		annotations,
		onEditValue,
		onSelectAnnotation,
		toolinfo,
		mode,
		currentFrame,
	}: {
		currentFrame: number;
		annotationValue: AnnotationValue;
		annotations: VideoAnnotation[];
		onEditValue: (annotationValue: AnnotationValue, mode: VideoMode) => void;
		onSelectAnnotation: (annotation: VideoAnnotation) => void;
		toolinfo: ToolInfo;
		mode: VideoMode;
	} = $props();

	function categorySelection(mode: VideoMode, category?: string) {
		if (category) {
			onEditValue(
				{
					...annotationValue,
					category,
				},
				mode,
			);
		} else {
			onEditValue(
				Object.fromEntries(Object.entries(annotationValue).filter(([type, _]) => type == "categories")),
				mode,
			);
		}
	}
</script>

<Sidebar variant="inset" collapsible="none">
	{#if toolinfo[mode]}
		<SidebarHeader />
		<SidebarContent>
			{#if toolinfo[mode].allowedFields.categories}
				<SidebarGroup>
					<SidebarGroupContent>
						<CategoriesSelection
							{annotations}
							{currentFrame}
							categories={toolinfo[mode].allowedFields.categories}
							selected={annotationValue.category}
							{onSelectAnnotation}
							onSelect={(s) => categorySelection(mode, s)}
							required={toolinfo[mode].requiredFields?.includes("categories") || false}
						/>
					</SidebarGroupContent>
				</SidebarGroup>
			{/if}
		</SidebarContent>
	{:else}
		<SidebarHeader>
			<Input placeholder="search" />
		</SidebarHeader>
		<SidebarContent>
			{#each Object.entries(toolinfo) as [type, tool]}
				<SidebarGroup>
					<SidebarGroupLabel>{type}</SidebarGroupLabel>
					<SidebarGroupContent>
						{#if tool.allowedFields.categories}
							<CategoriesSelection
								{annotations}
								{currentFrame}
								categories={tool.allowedFields.categories}
								selected={annotationValue.category}
								{onSelectAnnotation}
								onSelect={(s) => categorySelection(type, s)}
								required={tool.requiredFields?.includes("categories") || false}
							/>
						{:else}
							<SidebarMenuItem>
								<SidebarMenuButton>
									{type}
									{tool}
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/if}
					</SidebarGroupContent>
				</SidebarGroup>
			{/each}
		</SidebarContent>
		<SidebarFooter />
	{/if}
</Sidebar>
