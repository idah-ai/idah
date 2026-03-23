<script lang="ts">
  import { onMount } from "svelte";
  import { closeSearch, searchOpen, searchResults, searchQuery } from "$lib/app/bar/search-bar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { InputGroup, InputGroupAddon, InputGroupInput } from "$lib/components/ui/input-group";
  import { cn } from "$lib/utils";
  import { SearchIcon, XCircleIcon, FileTextIcon } from "@lucide/svelte";

  let pagefind: any = null;
  let isSearching = false;
  let isFocused = false;
  let popularTopics = [
    { title: "Getting Started", url: "/getting-started/about/" },
    { title: "Installation Guide", url: "/install/" },
    { title: "Create a Plugin", url: "/plugin/create-plugin/" },
    { title: "API Reference", url: "/apis/dataset/Projects/" },
    { title: "Key Features", url: "/getting-started/key-features/" },
  ];

  onMount(async () => {
    // Load Pagefind only in the browser after build
    if (typeof window !== "undefined") {
      try {
        // Dynamically import Pagefind as ES module
        // @ts-ignore
        pagefind = await import("/pagefind/pagefind.js");
        await pagefind.init();
      } catch (error) {
        console.warn("Pagefind not available (search only works in production build):", error);
      }
    }
  });

  async function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value;
    searchQuery.set(query);

    if (!query) {
      searchResults.set([]);
      return;
    }

    if (!pagefind) {
      searchResults.set([]);
      return;
    }

    isSearching = true;
    try {
      const search = await pagefind.search(query);

      const results = await Promise.all(
        search.results.slice(0, 15).map(async (r: any) => {
          const data = await r.data();
          return {
            url: data.url,
            title: data.meta?.title || "Untitled",
            excerpt: data.excerpt,
          };
        })
      );

      // Deduplicate results by URL
      const seen = new Set<string>();
      const uniqueResults = results.filter((result) => {
        if (seen.has(result.url)) {
          return false;
        }
        seen.add(result.url);
        return true;
      });

      // Limit to 10 results after deduplication
      searchResults.set(uniqueResults.slice(0, 10));
    } catch (error) {
      console.error("Search error:", error);
      searchResults.set([]);
    } finally {
      isSearching = false;
    }
  }

  function handleResultClick(url: string) {
    window.location.href = url;
    closeSearch();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      isFocused = false;
      closeSearch();
    }
  }

  function handleFocus() {
    isFocused = true;
  }

  function handleBlur() {
    // Delay to allow click events to register
    setTimeout(() => {
      isFocused = false;
    }, 200);
  }

  function handleOverlayClick() {
    isFocused = false;
    searchQuery.set("");
    searchResults.set([]);
    closeSearch();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- OVERLAY -->
{#if isFocused}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
    onclick={handleOverlayClick}
  ></div>
{/if}

<div class="relative flex w-full items-center justify-center">
  <!-- SEARCH INPUT -->
  <div
    class={cn(
      `
      flex-1
      min-w-[240px]
      max-w-lg
      items-center
      `,
      {
        "hidden lg:block": !$searchOpen,
        block: $searchOpen,
      },
    )}
  >
    <InputGroup class="w-full relative z-50 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
      <InputGroupAddon class="pointer-events-none bg-transparent">
        <SearchIcon class="h-4 w-4" />
      </InputGroupAddon>

      <InputGroupInput
        placeholder="Search documentation..."
        class="w-full"
        oninput={handleSearch}
        onfocus={handleFocus}
        onblur={handleBlur}
        value={$searchQuery}
      />

      <InputGroupAddon class="lg:hidden" align="inline-end">
        <Button variant="ghost" size="icon" onclick={closeSearch}>
          <XCircleIcon class="h-4 w-4" />
        </Button>
      </InputGroupAddon>
    </InputGroup>

    <!-- POPULAR TOPICS (shown when focused but no query) -->
    {#if isFocused && !$searchQuery}
      <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Popular Topics</h4>
        </div>
        <ul class="py-2">
          {#each popularTopics as topic}
            <li>
              <a
                href={topic.url}
                class="block px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
              >
                <SearchIcon class="w-4 h-4 flex-shrink-0" style="color: #2391ea;" />
                <span class="text-sm font-medium text-gray-900 dark:text-white">{topic.title}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- SEARCH RESULTS DROPDOWN -->
    {#if isFocused && $searchQuery}
      <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[400px] overflow-y-auto z-50">
        {#if isSearching}
          <div class="p-4 text-center text-gray-500 dark:text-gray-400">
            Searching...
          </div>
        {:else if $searchResults.length > 0}
          <ul class="py-2">
            {#each $searchResults as result}
              <li>
                <button
                  class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-start gap-3"
                  onclick={() => handleResultClick(result.url)}
                >
                  <FileTextIcon class="w-4 h-4 mt-1 flex-shrink-0" style="color: #2391ea;" />
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-900 dark:text-white mb-1">
                      {result.title}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {@html result.excerpt}
                    </div>
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="p-4 text-center text-gray-500 dark:text-gray-400">
            No results found for "{$searchQuery}"
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.pagefind-ui__search-input) {
    width: 100%;
  }
</style>
