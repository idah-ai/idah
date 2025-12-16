<script lang="ts">
  import SettingsCard from "@/components/app/settings/cards/settings-card.svelte";
  // import SettingsEmail from "@/components/app/settings/items/settings-email.svelte";
  import SettingsPassword from "@/components/app/settings/items/settings-password.svelte";
</script>

<SettingsCard title="Login methods">
  <!-- <SettingsEmail /> -->

  <SettingsPassword />
</SettingsCard>
