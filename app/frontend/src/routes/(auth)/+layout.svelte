<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import AuthenticationStatus from "@/components/app/iam/auth/authentication-status.svelte";
  import Redirect from "@/components/app/misc/redirect.svelte";

  import type { WithElementRef } from "@/utils";

  // Props
  let { children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<AuthenticationStatus>
  {#snippet authorized()}
    <Redirect to="/" />
  {/snippet}

  {#snippet unauthorized()}
    <div class="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div class="flex w-full max-w-sm flex-col gap-6">
        {@render children?.()}
      </div>
    </div>
  {/snippet}
</AuthenticationStatus>
