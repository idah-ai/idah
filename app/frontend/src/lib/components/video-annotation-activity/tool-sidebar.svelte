<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index";
	import type { VideoMode } from "@/components/video-activity/VideoAnnotationContext";
	import CommandManager from "@/command/CommandManager";
	import Button from "../ui/button/button.svelte";


    let {
        mode,
        onSelectMode,
    }:{
        mode:VideoMode
        onSelectMode?: (mode:VideoMode) => void,
    } = $props()

    let videoTools: Array<{type: VideoMode, d: string}> = [
        {

             type: 'view',
             d: "M10.6667 10.6667L15.3801 22L17.0534 17.0733L22.0001 15.38L10.6667 10.6667Z"
        },
        {
             type: 'bounding-box',
             d: "M13.3333 11.6667H18.6667M13.3333 11.6667C13.3333 12.5871 12.5871 13.3333 11.6667 13.3333M13.3333 11.6667C13.3333 10.7462 12.5871 10 11.6667 10C10.7462 10 10 10.7462 10 11.6667C10 12.5871 10.7462 13.3333 11.6667 13.3333M18.6667 11.6667C18.6667 12.5871 19.4129 13.3333 20.3333 13.3333M18.6667 11.6667C18.6667 10.7462 19.4129 10 20.3333 10C21.2538 10 22 10.7462 22 11.6667C22 12.5871 21.2538 13.3333 20.3333 13.3333M20.3333 13.3333V18.6667M20.3333 18.6667C19.4129 18.6667 18.6667 19.4129 18.6667 20.3333M20.3333 18.6667C21.2538 18.6667 22 19.4129 22 20.3333C22 21.2538 21.2538 22 20.3333 22C19.4129 22 18.6667 21.2538 18.6667 20.3333M18.6667 20.3333H13.3333M13.3333 20.3333C13.3333 21.2538 12.5871 22 11.6667 22C10.7462 22 10 21.2538 10 20.3333C10 19.4129 10.7462 18.6667 11.6667 18.6667M13.3333 20.3333C13.3333 19.4129 12.5871 18.6667 11.6667 18.6667M11.6667 18.6667V13.3333"
        },
    ]
</script>

<Sidebar.Root
    class='w-12'
    variant='inset'
    collapsible='none'
    side='right'
    >
 <Sidebar.Header/>
 <Sidebar.Content>
    <Sidebar.Group>
        <Sidebar.GroupContent>
            <Sidebar.Menu>
                {#each videoTools as tool}
                <Button
                    variant={mode == tool.type ? 'destructive' : 'default'}
                    onclick={() => onSelectMode?.(tool.type) }>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path class='stroke-secondary fill-secondary' d={tool.d} stroke="#0F172A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </Button>
                {/each}
            </Sidebar.Menu>
        </Sidebar.GroupContent>
    </Sidebar.Group>
 </Sidebar.Content>
 <Sidebar.Footer />
</Sidebar.Root>

