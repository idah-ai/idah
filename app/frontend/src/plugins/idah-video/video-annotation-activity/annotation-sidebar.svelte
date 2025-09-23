<script lang="ts">
    import Input from "@/components/ui/input/input.svelte";
    import Sidebar from "@/components/ui/sidebar/sidebar.svelte";

    import type { AnnotationValue } from "$lib/context/AnnotationContext";
    import type { CategoriesDefinition, ToolInfo } from "@/context/ActivityContext";
    import type { CategoryConfiguration, LabellingConfiguration, PropertyConfiguration, VideoAnnotation, VideoMode } from "./VideoAnnotationContext";
    import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
    import SidebarContent from "@/components/ui/sidebar/sidebar-content.svelte";
    import SidebarGroup from "@/components/ui/sidebar/sidebar-group.svelte";
    import SidebarGroupContent from "@/components/ui/sidebar/sidebar-group-content.svelte";
    import SidebarGroupLabel from "@/components/ui/sidebar/sidebar-group-label.svelte";
    import SidebarMenuItem from "@/components/ui/sidebar/sidebar-menu-item.svelte";
    import SidebarMenuButton from "@/components/ui/sidebar/sidebar-menu-button.svelte";
    import SidebarFooter from "@/components/ui/sidebar/sidebar-footer.svelte";
    import CategoriesSelection from "./categories-selection.svelte";
    import type { IActivityContext } from "@/plugin/interface/Activity";

    let {
        annotationValue,
        annotations,
        onEditValue,
        onSelectAnnotation,
        context,
        mode,
        currentFrame,
    }: {
        currentFrame: number;
        annotationValue: AnnotationValue;
        annotations: VideoAnnotation[];
        onEditValue: (annotationValue: AnnotationValue, mode: string) => void;
        onSelectAnnotation: (annotation: VideoAnnotation) => void;
        context: IActivityContext,
        mode: string;
    } = $props();

    console.log({annotations})

    // let categories = (context.config as LabellingConfiguration).categories.reduce((acc, v: CategoryConfiguration) => {

    //     if (!acc.has(v.type)) acc.set(v.type, [v])
    //     else {
    //         let categories = acc.get(v.type)

    //         if (categories) categories.push(v)
    //         else categories = [v]

    //         acc.set(v.type, categories)
    //     }
    //     return acc
    // }, new Map<string, CategoryConfiguration[]>())

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
    $effect(() => console.log({annotations}))

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
                                annotations={annotations.filter((a) => a.shape.type == tool)}
                                {currentFrame}
                                categories={categories}
                                selected={annotationValue.category}
                                {onSelectAnnotation}
                                onSelect={(s) => categorySelection(tool, s)}
                            />
                        </SidebarGroupContent>
                    </SidebarGroup>

            {/if}
        {/each}
    </SidebarContent>
    <!-- {#if toolinfo[mode]}
        <SidebarHeader />
        <SidebarContent>
            {#if toolinfo[mode].allowedFields.categories}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <CategoriesSelection
                            annotations={annotations.filter((a) => a.shape.type == mode)}
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
        <SidebarContent>
            {#each Object.entries(toolinfo) as [type, tool]}
                <SidebarGroup>
                    <SidebarGroupLabel>{type}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        {#if tool.allowedFields.categories}
                            <CategoriesSelection
                                annotations={annotations.filter((a) => a.shape.type == type)}
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
    {/if} -->
</Sidebar>
