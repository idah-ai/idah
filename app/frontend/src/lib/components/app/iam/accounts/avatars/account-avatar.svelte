<script lang="ts">
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
  import { Badge } from "@/components/ui/badge";
  import { cn } from "@/utils";

  import { getAvatarFallback, humanize } from "@/utils/string";

  // Props
  interface Props {
    align?: "start" | "center" | "end";
    size?: "sm" | "md";
    name?: string | null;
    email?: string | null;
    pictureUrl?: string | null;
    roleName?: string | null;
    showName?: boolean;
    showEmail?: boolean;
    showRole?: boolean;
  }
  let {
    align = "center",
    size = "md",
    name,
    email,
    pictureUrl,
    roleName,
    showName = false,
    showEmail = false,
    showRole = false,
  }: Props = $props();

  // Variables
  let sizeClasses: Record<string, string> = {
    sm: "size-6 text-sm",
    md: "size-8 text-base",
  };
</script>

<div class="flex items-{align} gap-2">
  <Avatar class={cn("rounded-lg", sizeClasses[size])}>
    <AvatarImage src={pictureUrl} alt={name} />
    <AvatarFallback class="rounded-lg">
      {getAvatarFallback(name || email || "")}
    </AvatarFallback>
  </Avatar>

  <div class="grid flex-1 text-left text-sm leading-tight">
    {#if showName}
      <span class="truncate font-medium">{name || email}</span>
    {/if}

    {#if showEmail}
      <span class="truncate text-xs">{email}</span>
    {/if}

    {#if showRole}
      <Badge variant="outline" class="mt-1">{humanize(roleName || "")}</Badge>
    {/if}
  </div>
</div>
