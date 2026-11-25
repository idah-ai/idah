<script lang="ts">
  import { CheckIcon, LockIcon } from "@lucide/svelte";

  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
  import { FieldGroup } from "@/components/ui/field";

  import { cn } from "@/utils";

  import type { Snippet } from "svelte";

  // Props
  interface Props {
    step: number;
    title: string;
    // Shown under the title while the step is closed.
    summary: string;
    open: boolean;
    // Filled in: a check replaces the number while the step is closed.
    complete?: boolean;
    hasErrors?: boolean;
    // A step before it isn't filled in yet: it can't be opened.
    locked?: boolean;
    // The last step draws no line down to a next one.
    last?: boolean;
    onToggle: (open: boolean) => void;
    children: Snippet;
  }
  let {
    step,
    title,
    summary,
    open,
    complete = false,
    hasErrors = false,
    locked = false,
    last = false,
    onToggle,
    children,
  }: Props = $props();

  let done: boolean = $derived(complete && !open && !hasErrors && !locked);
</script>

<!-- One step of the storage target form, as a vertical timeline: the step's circle and title on one clickable
     row, then the line down to the next step beside the step's fields. One step is open at a time. -->
<Collapsible {open} onOpenChange={onToggle} disabled={locked}>
  <CollapsibleTrigger
    aria-label="Step {step}: {title}{locked ? ' (fill in the steps before this one first)' : ''}"
    title={locked ? "Fill in the steps before this one first" : undefined}
    class={cn(
      "group -mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors",
      "hover:bg-muted/70 focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
      "data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent",
    )}
  >
    <span
      class={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
        "group-hover:border-primary group-data-[disabled]:group-hover:border-border",
        open && "bg-primary text-primary-foreground border-primary",
        done && "bg-primary/10 text-primary border-primary",
        hasErrors && "border-destructive text-destructive group-hover:border-destructive bg-transparent",
        locked && "text-muted-foreground",
      )}
    >
      {#if done}
        <CheckIcon class="size-4" />
      {:else}
        {step}
      {/if}
    </span>

    <span class="flex min-w-0 flex-1 flex-col">
      <span
        class={cn(
          "text-sm font-medium transition-colors",
          !open && !done && "text-muted-foreground group-hover:text-foreground",
          locked && "group-hover:text-muted-foreground",
          hasErrors && "text-destructive group-hover:text-destructive",
        )}
      >
        {title}
      </span>
      {#if !open}
        <span class={cn("truncate text-xs", hasErrors ? "text-destructive" : "text-muted-foreground")}>
          {hasErrors ? "Needs your attention" : summary}
        </span>
      {/if}
    </span>

    {#if locked}
      <LockIcon class="text-muted-foreground size-3.5 shrink-0" />
    {/if}
  </CollapsibleTrigger>

  <div class="flex gap-3">
    <div class="flex w-7 shrink-0 justify-center">
      {#if !last}
        <div class={cn("my-1 w-px", done ? "bg-primary" : "bg-border")}></div>
      {/if}
    </div>

    <div class={cn("min-w-0 flex-1", !last && "min-h-4 pb-3")}>
      <CollapsibleContent class="pt-2 pr-1">
        <FieldGroup>
          {@render children()}
        </FieldGroup>
      </CollapsibleContent>
    </div>
  </div>
</Collapsible>
