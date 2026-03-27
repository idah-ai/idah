<script lang="ts">
  import { onMount } from "svelte";
  import { closeSearch, searchOpen, searchResults, searchQuery } from "$lib/app/bar/search-bar.store";
  import Button from "$lib/components/ui/button/button.svelte";
  import { InputGroup, InputGroupAddon, InputGroupInput } from "$lib/components/ui/input-group";
  import { cn } from "$lib/utils";
  import {
    SearchIcon,
    XCircleIcon,
    FileTextIcon,
    PlayCircleIcon,
    DownloadIcon,
    PuzzleIcon,
    CodeIcon,
    SparklesIcon,
  } from "@lucide/svelte";

  let pagefind: any = null;
  let isSearching = false;
  let isFocused = false;
  let isDevelopment = import.meta.env.DEV;

  let popularTopics = [
    {
      title: "Getting Started",
      url: "/getting-started/about/",
      description: "Learn about IDAH and its core concepts",
      icon: PlayCircleIcon,
      iconColor: "#10b981",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Installation Guide",
      url: "/install/",
      description: "Set up IDAH on your local machine or server",
      icon: DownloadIcon,
      iconColor: "#2391ea",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Create a Plugin",
      url: "/plugin/create-plugin/",
      description: "Extend IDAH with custom annotation tools",
      icon: PuzzleIcon,
      iconColor: "#8b5cf6",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "API Reference",
      url: "/apis/dataset/Projects/",
      description: "Browse the complete API documentation",
      icon: CodeIcon,
      iconColor: "#f59e0b",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      title: "Key Features",
      url: "/getting-started/key-features/",
      description: "Discover what makes IDAH powerful",
      icon: SparklesIcon,
      iconColor: "#ec4899",
      bgColor: "bg-pink-100 dark:bg-pink-900/30",
    },
  ];

  // Mock results for development
  let mockResults = [
    {
      url: "/plugin/create-plugin/",
      title: "Create a Plugin",
      excerpt:
        "Learn how to create custom <mark>plugins</mark> for IDAH. This guide covers the plugin structure, development workflow, and best practices.",
    },
    {
      url: "/getting-started/about/",
      title: "About IDAH",
      excerpt:
        "IDAH is an open-source platform for collaborative data annotation, designed to streamline the creation of high-quality training datasets.",
    },
    {
      url: "/install/",
      title: "Installation",
      excerpt:
        "Follow these steps to install and configure IDAH on your system. Supports Docker, local development, and production deployments.",
    },
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

    // In development, use mock results
    if (isDevelopment) {
      searchResults.set(mockResults);
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
        }),
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

  function handleClose() {
    isFocused = false;
    searchQuery.set("");
    searchResults.set([]);
    closeSearch();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- OVERLAY -->
{#if isFocused}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity" onclick={handleClose}></div>
{/if}

<div class="relative flex w-full items-center justify-center lg:px-0">
  <!-- SEARCH INPUT -->
  <div
    class={cn(
      `
      fixed
      inset-x-0
      md:relative
      md:top-auto
      w-full
      md:w-[300px]
      lg:w-[500px]
      items-center
      px-4
      md:px-0
      bg-white
      dark:bg-gray-950
      md:bg-transparent
      py-4
      md:py-0
      border-b
      md:border-0
      border-gray-200
      dark:border-gray-700
      z-50
      `,
      {
        "hidden md:block": !$searchOpen,
        block: $searchOpen,
      },
    )}
  >
    <InputGroup
      class="w-full relative z-50 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-300 dark:border-gray-600"
    >
      <InputGroupAddon class="pointer-events-none bg-transparent">
        <SearchIcon class="h-4 w-4" />
      </InputGroupAddon>

      <InputGroupInput
        placeholder="Search documentation..."
        class="w-full"
        oninput={handleSearch}
        onfocus={handleFocus}
        // onblur={handleBlur}
        value={$searchQuery}
      />

      <InputGroupAddon class="md:hidden" align="inline-end">
        <Button variant="ghost" size="icon" onclick={handleClose} class="hover:bg-transparent hover:cursor-pointer">
          <XCircleIcon class="h-4 w-4" />
        </Button>
      </InputGroupAddon>
    </InputGroup>

    <!-- POPULAR TOPICS (shown when focused but no query) -->
    {#if isFocused && !$searchQuery}
      <div
        class="absolute w-full top-full left-0 md:mx-0 md:left-auto md:right-auto md:w-100 lg:w-125 md:mt-2 bg-white dark:bg-gray-800 border-t md:border border-gray-200 dark:border-gray-700 md:rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        <div
          class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-750"
        >
          <h4 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span style="color: #2391ea;">✨</span>
            Popular Topics
          </h4>
        </div>
        <ul class="py-2">
          {#each popularTopics as topic}
            <li>
              <a
                href={topic.url}
                class="block px-5 py-4 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-200 group"
              >
                <div class="flex items-start gap-3">
                  <div class="p-2 rounded-lg {topic.bgColor} group-hover:scale-110 transition-transform">
                    <svelte:component
                      this={topic.icon}
                      class="w-4 h-4 shrink-0"
                      style="color: {topic.iconColor};"
                    />
                  </div>
                  <div class="flex-1">
                    <div
                      class="text-sm font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                    >
                      {topic.title}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {topic.description}
                    </div>
                  </div>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- SEARCH RESULTS DROPDOWN -->
    {#if isFocused && $searchQuery}
      <div
        class="absolute w-full top-full left-0 md:mx-0 md:left-auto md:right-auto md:w-100 lg:w-125 md:mt-2 bg-white dark:bg-gray-800 border-t md:border border-gray-200 dark:border-gray-700 md:rounded-lg shadow-xl max-h-100 overflow-y-auto z-50"
      >
        {#if isSearching}
          <div class="p-4 text-center text-gray-500 dark:text-gray-400">Searching...</div>
        {:else if $searchResults.length > 0}
          <ul class="py-2">
            {#each $searchResults as result}
              <li>
                <button
                  class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-start gap-3"
                  onclick={() => handleResultClick(result.url)}
                >
                  <FileTextIcon class="w-4 h-4 mt-1 shrink-0" style="color: #2391ea;" />
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
