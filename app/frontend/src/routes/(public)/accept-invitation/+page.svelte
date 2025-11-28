<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  async function updateAccount(): Promise<void> {
    try {
      const accountResponse = await accountsBackendDataSource.join({
        id: page.url.searchParams.get("accountId") as string,
      });
      const passwordResetToken = accountResponse.meta.password_reset_token || "";

      goto(resolve(`/reset-password?password_reset_token=${passwordResetToken}`));
    } catch (error) {
      console.error("Error accepting invitation", error);
      goto(resolve("/error"));
    }
  }

  onMount(() => {
    updateAccount();
  });
</script>
