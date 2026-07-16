<script lang="ts">
  import { CircleQuestionMarkIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";

  import { DATASET_MODALITY_MAP } from "@/data/model/dataset/datasets/constants";
  import { mapToBadge } from "@/utils/badgeMap";
  import { humanize } from "@/utils/string";

  interface Props {
    modality: string;
  }
  let { modality }: Props = $props();

  const badge = $derived(
    mapToBadge(modality, DATASET_MODALITY_MAP, {
      label: humanize(modality),
      variant: "outline",
      icon: CircleQuestionMarkIcon,
    }),
  );
</script>

<Badge variant={badge.variant}>
  <badge.icon />
  {badge.label}
</Badge>
