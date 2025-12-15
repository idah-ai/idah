<script lang="ts">
  import { Card, CardContent } from "@/components/ui/card";
  import { Checkbox } from "@/components/ui/checkbox";
  import { Skeleton } from "@/components/ui/skeleton";

  interface Props {
    showCheckbox?: boolean;
  }
  let { showCheckbox = false }: Props = $props();
</script>

<Card>
  <CardContent class="flex flex-row gap-4">
    <!-- CHECKBOX -->
    {#if showCheckbox}
      <div class="my-auto">
        <Checkbox checked={false} />
      </div>
    {/if}

    <!-- THUMBNAIL -->
    <div class="h-full overflow-hidden" style:width="240px" style:max-width="240px">
      <Skeleton class="min-h-[135px]" />
    </div>

    <!-- INFO -->
    <div class="flex flex-1 flex-col gap-6">
      <Skeleton class="h-5 w-1/3 rounded" />

      <div class="flex flex-col items-start">
        <Skeleton class="mb-2 h-4 w-1/4 rounded" />
        <Skeleton class="h-4 w-1/4 rounded" />
      </div>

      <div>
        <Skeleton class="h-5 w-20 rounded-lg" />
      </div>
    </div>

    <!-- STAGE & ASSIGNED TO -->
    <div class="my-auto flex flex-1 flex-col gap-2">
      <Skeleton class="h-4 w-1/3 rounded" />
      <Skeleton class="h-4 w-1/3 rounded" />
    </div>

    <!-- STATUS & ACTIONS -->
    <div>
      <div class="flex items-center gap-2">
        <Skeleton class="h-5 w-20 rounded-lg" />
        <Skeleton class="h-6 w-6 rounded-lg" />
      </div>
    </div>
  </CardContent>
</Card>
