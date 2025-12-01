<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { BellIcon, BrushIcon, ShieldIcon } from "@lucide/svelte";
  import { type Snippet } from "svelte";

  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import type { BaseTabs } from "@/components/ui/tabs/tabs.types";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();

  // Variables
  type SettingsTab = "appearance" | "notifications" | "security";
  const settingsTabs: BaseTabs<SettingsTab> = [
    {
      label: "Appearance",
      value: "appearance",
      icon: BrushIcon,
    },
    {
      label: "Notifications",
      value: "notifications",
      icon: BellIcon,
    },
    {
      label: "Password & Authentication",
      value: "security",
      icon: ShieldIcon,
    },
  ];

  // Functions
  function navigateTo(tabValue: SettingsTab) {
    goto(resolve(`/settings/${tabValue}`));
  }
</script>

<PageProvider name="settings">
  <PageHeader title="Settings"></PageHeader>

  <div class="flex gap-4">
    <div class="bg-sidebar flex h-full max-w-72 min-w-64 flex-col gap-0.5 rounded-lg p-2">
      {#each settingsTabs as tab (tab.value)}
        {@const isSelected = page.url.pathname.includes(tab.value)}

        <Button
          variant={isSelected ? "outline" : "ghost"}
          class="justify-start text-left"
          onclick={() => navigateTo(tab.value)}
        >
          <tab.icon />

          <span>{tab.label}</span>
        </Button>
      {/each}
    </div>

    <section class="flex flex-1 flex-col gap-6">
      {@render children?.()}
    </section>
  </div>
</PageProvider>
