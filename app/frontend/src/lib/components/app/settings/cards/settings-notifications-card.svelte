<script lang="ts">
  import SettingsCard from "@/components/app/settings/cards/settings-card.svelte";
  import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
  import Switch from "@/components/ui/switch/switch.svelte";

  import {
    accountSettingBackendDataSource,
    organizationActivitiesKey,
    projectActivitiesKey,
  } from "@/data/model/setting/account_setting/record";
  import { authStatus } from "@/security/AuthContext";

  // Variables
  let notifications = $state({
    [organizationActivitiesKey]: true,
    [projectActivitiesKey]: true,
  });
  let allNotificationsChecked = $derived(Object.values(notifications).every((value) => value === true));

  // Functions
  async function loadNotificationSettings() {
    return await Promise.all(Object.keys(notifications).map((key) => loadSetting(key as keyof typeof notifications)));
  }

  async function loadSetting(key: keyof typeof notifications) {
    if (!$authStatus.authContext?.id) return;

    const response = await accountSettingBackendDataSource.list({
      filters: {
        account_id: $authStatus.authContext.id,
        key,
      },
    });
    notifications[key] = response.data.length ? (response.data[0].value as boolean) : false;

    return response.data[0];
  }

  async function updateAccountSetting(id: string | undefined, value: boolean) {
    if (!id) return;
    await accountSettingBackendDataSource.update(id, {
      attributes: {
        value,
      },
    });
  }

  async function toggleAllNotifications(ids: Array<string | undefined>, checkedValue: boolean) {
    if (!ids.length) return;

    ids.forEach(async (id) => {
      if (!id) return;
      await updateAccountSetting(id, checkedValue);
    });

    Object.entries(notifications).forEach(([key]) => {
      notifications[key as keyof typeof notifications] = checkedValue;
    });
  }
</script>

{#await loadNotificationSettings() then [organizationActivities, projectActivities]}
  <SettingsCard title="Notifications">
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>All notifications</ItemTitle>
        <ItemDescription>Receive an email notification for all events.</ItemDescription>
      </ItemContent>

      <ItemActions>
        <Switch
          checked={allNotificationsChecked}
          onCheckedChange={(checkedValue) => {
            toggleAllNotifications([organizationActivities?.id, projectActivities?.id], checkedValue);
          }}
        />
      </ItemActions>
    </Item>
  </SettingsCard>

  <Item variant="outline">
    <ItemContent>
      <ItemTitle>Organization activities</ItemTitle>
      <ItemDescription>Organization ownership changes</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Switch
        checked={notifications[organizationActivitiesKey]}
        onCheckedChange={(checkedChange) => {
          updateAccountSetting(organizationActivities?.id, checkedChange);
          notifications[organizationActivitiesKey] = checkedChange;
        }}
      />
    </ItemActions>
  </Item>

  <Item variant="outline">
    <ItemContent>
      <ItemTitle>Project activities</ItemTitle>
      <ItemDescription>Project membership changes • Dataset completed</ItemDescription>
    </ItemContent>

    <ItemActions>
      <Switch
        checked={notifications[projectActivitiesKey]}
        onCheckedChange={(checkedChange) => {
          updateAccountSetting(projectActivities?.id, checkedChange);
          notifications[projectActivitiesKey] = checkedChange;
        }}
      />
    </ItemActions>
  </Item>
{/await}
