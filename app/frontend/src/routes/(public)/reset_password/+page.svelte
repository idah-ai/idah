<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  let accountId: string = page.url.searchParams.get("id") as string;
  console.log(accountId);

  async function joinAccount(): Promise<void> {
    try{

      const response = await accountsBackendDataSource.join({ id: accountId });
    }
    catch (error) {
      goto("/error");
    }
    
  }
</script>

{#await joinAccount()}
    
  {:then _} 
    
  {/await}
