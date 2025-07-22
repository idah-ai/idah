<script lang='ts'>
	import CommandManager from "@/command/CommandManager";
	import Menubar from "../ui/menubar/menubar.svelte";
	import Button from "../ui/button/button.svelte";
    import SunIcon from "@lucide/svelte/icons/sun";
    import MoonIcon from "@lucide/svelte/icons/moon";
    import { toggleMode } from "mode-watcher";
	import { MenubarMenu, MenubarTrigger } from "../ui/menubar";
	import type { ActivityContext } from "@/context/ActivityContext";

    let {
        context
    } : {
        context: ActivityContext
    } = $props()
</script>

<Menubar>
    <Button onclick={toggleMode} variant="outline" size="icon">
    <SunIcon
        class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 !transition-all dark:-rotate-90 dark:scale-0"
    />
    <MoonIcon
        class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 !transition-all dark:rotate-0 dark:scale-100"
    />
    <span class="sr-only">Toggle theme</span>
    </Button>
    <MenubarMenu>
        <MenubarTrigger>
            {context.medias['main'].url}
        </MenubarTrigger>
    </MenubarMenu>
    <Button  onclick={() => { CommandManager.undo() }}>
        undo
    </Button>
    <Button  onclick={() => { CommandManager.redo() }}>
        redo
    </Button>
    <Button onclick={() => console.log(CommandManager)}>
        log
    </Button>
</Menubar>
