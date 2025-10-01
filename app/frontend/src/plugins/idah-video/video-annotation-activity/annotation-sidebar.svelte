<script lang="ts">
    import Input from "@/components/ui/input/input.svelte";
    import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

    import type { AnnotationValue } from "$lib/context/AnnotationContext";
    import type { CategoryConfiguration, LabellingConfiguration, PropertyConfiguration, VideoAnnotation, VideoMode } from "./VideoAnnotationContext";
    import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
    import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
    import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
    import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
    import SidebarGroupLabel from "@/components/ui/sidebar/sidebar-group-label.svelte";
    import CategoriesSelection from "./categories-selection.svelte";
    import type { IActivityContext } from "@/plugin/interface/Activity";
    import type { AnnotationsIndexedDB } from "./indexedDB";

    let {
        annotationValue,
        onEditValue,
        onSelectAnnotation,
        context,
        mode,
        currentFrame,
        db
    }: {
        currentFrame: number;
        annotationValue: AnnotationValue;
        onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
        onSelectAnnotation: (annotation: VideoAnnotation) => void;
        context: IActivityContext,
        mode: string,
        db?: AnnotationsIndexedDB;
    } = $props();

    let tools = (context.config as LabellingConfiguration).categories.reduce((acc, v: CategoryConfiguration) => {

        if (!acc.has(v.type)) acc.set(v.type, [v])
        else {
            let categories = acc.get(v.type)

            if (categories) categories.push(v)
            else categories = [v]

            acc.set(v.type, categories)
        }
        return acc
    }, new Map<string, CategoryConfiguration[]>())


    function categorySelection(mode: string, category?: string) {
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
    <SidebarHeader>
        {#if !tools.has(mode)}
            <Input placeholder="search" />
        {/if}
    </SidebarHeader>
    <SidebarContent>
        {#each tools as [tool, categories]}
            {#if !tools.has(mode) || tool == mode}
                    <SidebarGroup>
                        <SidebarGroupLabel>{tool}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <CategoriesSelection
                                {db}
                                type={tool}
                                {currentFrame}
                                {categories}
                                selected={annotationValue.category}
                                {onSelectAnnotation}
                                onSelect={(s) => categorySelection(tool, s)}
                            />
                        </SidebarGroupContent>
                    </SidebarGroup>

            {/if}
        {/each}
    </SidebarContent>
</Sidebar>
