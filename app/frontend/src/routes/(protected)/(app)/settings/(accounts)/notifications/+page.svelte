<script lang="ts">
  import SettingsNotificationsCard from "@/components/app/settings/cards/settings-notifications-card.svelte";

  import { settingBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  pageBreadcrumbsStore.set([
    settingBreadcrumb,
    {
      label: "Notifications",
    },
  ]);
</script>

<SettingsNotificationsCard />
