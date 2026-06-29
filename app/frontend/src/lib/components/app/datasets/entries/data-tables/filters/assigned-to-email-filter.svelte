<script lang="ts" generics="T extends Record">
  import { CircleXIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import UnassignedAvartar from "@/components/app/datasets/entries/data-tables/filters/unassigned-avartar.svelte";
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";

  import { Input } from "@/components/ui/input";
  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { Record } from "@/data/model/Record";
  import { cn } from "@/utils";

  import type {
    DataTableColumnFilterOperation,
    DataTableFilterBaseProps,
  } from "@/components/app/datasource-table/types";
  import type { WheelEventHandler } from "svelte/elements";

  // Props
  let { columnSetting, contexts, filters, onFilter }: DataTableFilterBaseProps<T> = $props();

  // Contexts
  if (!contexts || !("projectId" in contexts)) {
    throw new Error("`projectId` is required in contexts for FilterByProjectMember");
  }
  let { projectId } = contexts as { projectId: string };

  // Filter key → assigned_to_email__match
  const filterKey: string = columnSetting.filterOptions?.filterKey || "assigned_to_email";
  const filterOperation: DataTableColumnFilterOperation = columnSetting.filterOptions?.filterOperation || "match";
  const emailKey: string = `${filterKey}__${filterOperation}`;

  // The input value AND the member-search query. Seeded from the active filter on each mount, so the
  // typed text survives the filter popover unmounting (close/reopen) and page reloads. The wrapper
  // remounts this component (via `{#key}`) whenever the applied filter changes, which re-seeds it.
  let draft: string = $state((filters[emailKey] as string | undefined) ?? "");

  // Member list (searched by email via the project members data source)
  let members: ProjectMemberRecord[] = $state([]);
  let page = $state(1);
  let itemsPerPage = $state(10);
  let hasMore = $state(true);
  let listElement: HTMLDivElement | null = $state(null);

  // Display flags
  let unassignedActive = $derived(String(filters["assigned"]) === "false");
  // Show "Unassigned" when the box is empty, when the text matches its label, or when `draft` is an
  // actual member's email (i.e. a picked member). Hide it for free-text searches like "admin" that
  // don't correspond to a member — even after Enter applies them.
  let showUnassigned = $derived(
    !draft || "unassigned".includes(draft.toLowerCase()) || members.some((member) => member.email === draft),
  );

  // Lifecycle
  onMount(async () => {
    await fetchMembers();
  });

  // Functions
  async function fetchMembers(): Promise<void> {
    const response = await projectMembersBackendDataSource.list({
      filters: {
        project_id: projectId,
        ...(draft ? { email__match: draft } : {}),
      },
      pagination: { page, itemsPerPage },
      sort: ["-id"],
      count: true,
    });

    hasMore = response.meta?.count ? response.meta.count > page * itemsPerPage : false;
    members = page === 1 ? response.data : [...members, ...response.data];
  }

  async function handleInput(event: Event): Promise<void> {
    draft = (event.currentTarget as HTMLInputElement).value;
    page = 1;
    await fetchMembers();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyEmail(draft);
  }

  // Member-pick and free text both write the same key; an empty string removes it.
  function applyEmail(text: string): void {
    onFilter({ filters: { ...filters, assigned: undefined, [emailKey]: text || undefined } });
  }

  function selectMember(member: ProjectMemberRecord): void {
    draft = member.email;
    applyEmail(member.email);
  }

  function selectUnassigned(): void {
    draft = "";
    onFilter({ filters: { ...filters, [emailKey]: undefined, assigned: false } });
  }

  // X: clear the input AND remove the email filter (no silently-active filter).
  async function clear(): Promise<void> {
    draft = "";
    page = 1;
    onFilter({ filters: { ...filters, [emailKey]: undefined, assigned: undefined } });
    await fetchMembers();
  }

  const scrollToPaginate: WheelEventHandler<HTMLDivElement> = async (event) => {
    if (event.deltaY <= 0 || !hasMore || !listElement) return;

    const target = event.currentTarget as HTMLElement;
    const scrollPercentage = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;

    if (scrollPercentage >= 60) {
      page += 1;
      await fetchMembers();
    }
  };
</script>

<div class="flex flex-col">
  <!-- Email / member search with clear (X) -->
  <div class="relative p-2">
    <Input
      placeholder="Search a member or type an email"
      value={draft}
      oninput={handleInput}
      onkeydown={handleKeydown}
    />
    {#if draft}
      <button
        type="button"
        class="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer opacity-50 hover:opacity-100"
        onclick={clear}
      >
        <CircleXIcon class="size-4" />
      </button>
    {/if}
  </div>

  <!-- Options list -->
  <div bind:this={listElement} onwheel={scrollToPaginate} class="max-h-64 overflow-y-auto p-1">
    {#if showUnassigned}
      <button
        type="button"
        class={cn("hover:bg-accent flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5", {
          "bg-primary/10": unassignedActive,
        })}
        onclick={selectUnassigned}
      >
        <UnassignedAvartar isSelected={unassignedActive} />
      </button>
    {/if}

    {#each members as member (member.id)}
      {@const isSelected = filters[emailKey] === member.email}
      <button
        type="button"
        class={cn("hover:bg-accent flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5", {
          "bg-primary/10": isSelected,
        })}
        onclick={() => selectMember(member)}
      >
        <AccountAvatar name={member.name} email={member.email} showName showEmail size="sm" {isSelected} />
      </button>
    {/each}

    {#if members.length === 0 && !showUnassigned}
      <p class="text-muted-foreground px-2 py-1.5 text-center text-sm">No member found.</p>
    {/if}
  </div>
</div>
