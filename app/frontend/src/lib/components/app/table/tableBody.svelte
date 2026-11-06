<script lang="ts">
  import type { Snippet } from "svelte";
  import { TableBody, TableRow, TableCell } from "@/components/ui/table";
  import { Button } from "@/components/ui/button";
  import Spinner from "@/components/ui/spinner/spinner.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";

  let {
    status,
    label,
    colspan,
    empty,
    error,
    onRetry,
    children,
  }: {
    status: "loading" | "ready" | "error";
    label: string;
    colspan: number;
    empty: boolean;
    error: string;
    onRetry: () => void | Promise<void>;
    children: Snippet;
  } = $props();
</script>

<TableBody>
  {#if status === "loading"}
    <TableRow>
      <TableCell {colspan} class="py-8 text-center">
        <Spinner class="mx-auto" aria-label={"Loading " + label.toLowerCase()} />
      </TableCell>
    </TableRow>
  {:else if status === "error"}
    <TableRow>
      <TableCell {colspan}>
        <ResponseBlock size="sm" title={label + " unavailable"} description={error}>
          {#snippet actions()}
            <Button variant="outline" size="sm" onclick={() => void onRetry()}>Retry</Button>
          {/snippet}
        </ResponseBlock>
      </TableCell>
    </TableRow>
  {:else if empty}
    <TableRow>
      <TableCell {colspan} class="text-muted-foreground py-8 text-center">
        No {label.toLowerCase()} on this page.
      </TableCell>
    </TableRow>
  {:else}
    {@render children()}
  {/if}
</TableBody>
