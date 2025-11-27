<script lang="ts">
  import { setMode } from "mode-watcher";

  import SettingsCard from "@/components/app/settings/cards/settings-card.svelte";
  import { Item, ItemContent, ItemHeader, ItemTitle } from "@/components/ui/item";
  import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

  import type { LabelValue } from "@/utils/types";

  // Variables
  type Mode = "light" | "dark" | "system";
  let currentMode: Mode = "system";
  const modes: (LabelValue<Mode> & { src: string })[] = [
    { label: "Light", value: "light", src: "/src/lib/components/app/settings/cards/theme-appearance-light.svg" },
    { label: "Dark", value: "dark", src: "/src/lib/components/app/settings/cards/theme-appearance-dark.svg" },
    { label: "System", value: "system", src: "/src/lib/components/app/settings/cards/theme-appearance-dark.svg" },
  ];

  // Functions
  async function selectMode(mode: Mode) {
    setMode(mode);
    currentMode = mode;
  }
</script>

<SettingsCard
  title="Theme preferences"
  description="Choose how IDAH looks to you. Select a single theme, or sync with your system and automatically switch between light and dark modes. Selections are applied immediately and saved automatically."
>
  <RadioGroup value={currentMode} class="grid grid-cols-3 gap-4">
    {#each modes as mode (mode.value)}
      <Item variant="outline" onclick={() => selectMode(mode.value)}>
        <ItemHeader>
          <img src={mode.src} alt={mode.label} class="w-full rounded-sm object-cover" />
        </ItemHeader>
        <ItemContent class="flex flex-row items-center gap-2">
          <RadioGroupItem value={mode.value} id={mode.value} />
          <ItemTitle>{mode.label}</ItemTitle>
        </ItemContent>
      </Item>
    {/each}
  </RadioGroup>
</SettingsCard>
