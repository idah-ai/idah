<script lang="ts">
  import { TriangleAlertIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";

  import { pluralizeUnit } from "@/utils/unit";

  const totalAnnotationErrorsCount: number = 3;
</script>

<Badge variant="destructive-outline" rounded="full">
  <TriangleAlertIcon />
  {totalAnnotationErrorsCount}
  {pluralizeUnit(totalAnnotationErrorsCount, "annotation error")}
</Badge>
