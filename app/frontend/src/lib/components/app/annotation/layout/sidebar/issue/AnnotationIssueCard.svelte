<script lang="ts">
  import { Avatar, AvatarFallback } from "@/components/ui/avatar";
  import Button from "@/components/ui/button/button.svelte";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

  import { CircleCheckIcon, Trash2Icon } from "@lucide/svelte";

  // Props
  interface Props {
    order: number;
  }
  let { order }: Props = $props();
</script>

<Card class="hover:bg-primary/5 group">
  <CardHeader class="flex items-center">
    <CardTitle>Issue #{order}</CardTitle>

    <div class="ml-auto flex items-center">
      <Button variant="ghost" size="icon">
        <CircleCheckIcon class="size-4" />
      </Button>

      <Button variant="ghost" size="icon">
        <Trash2Icon class="size-4" />
      </Button>
    </div>
  </CardHeader>

  <CardContent>
    <div class="flex flex-col gap-2">
      <div class="flex w-full items-center gap-2">
        <Avatar>
          <AvatarFallback>AJ</AvatarFallback>
        </Avatar>
        <div class="font-semibold">Alex Johnson</div>
        <div class="text-muted-foreground ml-auto">1 day ago</div>
      </div>

      <div class="text-muted-foreground ml-10">This annotation is not good, need to be fix.</div>
    </div>
  </CardContent>
</Card>
