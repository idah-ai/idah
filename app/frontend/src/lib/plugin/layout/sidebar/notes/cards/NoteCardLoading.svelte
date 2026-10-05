<script lang="ts">
  import Skeleton from "@/components/ui/skeleton/skeleton.svelte";
</script>

<div class="flex flex-col gap-2 p-2">
  <!-- HEADER -->
  <div class="flex w-full items-center gap-2 pr-2">
    <!-- HEADER::ICON -->
    <Skeleton class="size-8 shrink-0 rounded-full" />

    <!-- HEADER::CREATED BY & CREATED AT & FEEDBACKS -->
    <div class="flex flex-1 flex-col gap-1">
      <Skeleton class="h-2 w-1/4" />
      <Skeleton class="h-2 w-2/4" />
    </div>

    <!-- HEADER::ACTIONS -->
    <Skeleton class="size-4 rounded-full" />
    <Skeleton class="size-4 rounded-full" />
  </div>

  <!-- CONTENT -->
  <div class="flex flex-col gap-1">
    <Skeleton class="h-2 w-2/4" />
    <Skeleton class="h-2 w-3/5" />
    <Skeleton class="h-2 w-4/5" />

    <!-- CONTENT::REPLY -->
    <Skeleton class="mt-2 h-3 w-12" />
  </div>
</div>
