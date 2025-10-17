<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import { ArrowLeftIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import type { CategoryDefinition } from "@/context/ActivityContext";
  import type { AnnotationsIndexedDB } from "../indexedDB";

  let {
    db,
    selectedId,
    selectedCategory,
    name,
    onSelect,
    onSelectMode,
  }: {
    selectedId: string | undefined;
    selectedCategory: string | undefined;
    db?: AnnotationsIndexedDB;
    name: string;
    onSelect: (category?: CategoryDefinition) => void;
    onSelectMode: (mode: string) => void;
  } = $props();

  async function getSelectedAnnotationIndex() {
    if (!db) return 0;

    return (await db.getAllIndex("category", selectedCategory)).findIndex(
      (annotation) => annotation.metadata.id == selectedId,
    ) as number;
  }
</script>

<nav id="category-header-bar" class="flex h-10 items-center justify-between gap-2 pb-2">
  <div id="category-navigations" class="flex h-full flex-1 items-center gap-2">
    <!-- BACK BUTTON -->
    <Button
      variant="ghost"
      onclick={() => {
        onSelect(undefined);
        onSelectMode("visual");
      }}
    >
      <ArrowLeftIcon class="size-4" />
      Back
    </Button>

    <Separator orientation="vertical" />

    <!-- CATEGORY NAME -->
    <Button variant="ghost">{name}</Button>
  </div>
</nav>
