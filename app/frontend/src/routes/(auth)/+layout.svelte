<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import AuthenticationStatus from "@/components/app/iam/auth/authentication-status.svelte";
  import Redirect from "@/components/app/misc/redirect.svelte";

  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  import type { WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";

  // Props
  let { children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();


  // Functions
  async function updateAccount(): Promise<void> {
    try {
      await accountsBackendDataSource.join({
        id: page.url.searchParams.get("accountId") as string
      });
    } catch (error) {
      goto(resolve("/error"));
      return;
    }
  }

  onMount(() => {
    updateAccount();
  });
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
