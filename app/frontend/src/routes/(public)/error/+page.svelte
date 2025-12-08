<script lang="ts">
  import Invalidlink from "@/components/app/response-block/invalid-link.svg";
  import Text from "@/components/ui/text/Text.svelte";
</script>

<div class="flex h-screen w-full items-center justify-center">
  <div class="flex flex-col gap-4 text-center">
    <img class="h-50 w-full items-center justify-center" src={Invalidlink} alt="invalid-link" />

    <Text size="h2" weight="bold">Invalid or expired link</Text>

    <div class="flex flex-col gap-1 text-center">
      <Text>The invitation link is invalid or expired.</Text>
      <Text>If you believe this is a mistake, please contact the administrator.</Text>
    </div>
  </div>
</div>
