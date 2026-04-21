<!-- THIS BLOCK IS ONLY TO DEMO THE HEADER OF IDAH PLATFORM -->
<!-- FOR DEMO PURPOSES ONLY AND WILL NOT BE PART OF THE FINAL PLUGIN -->
<nav id="annotation-header-bar" class="grid grid-cols-3 border-b p-1">
  <div id="navigations" class="flex h-full items-center gap-2">
    <button
      data-slot="button"
      class="focus-visible:border-ring relative focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 cursor-pointer bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border h-7 gap-1.5 rounded-md px-3 has-[&gt;svg]:px-2.5 [&amp;_svg:not([class*='size-'])]:size-3.5 text-xs"
      type="button"
      disabled
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide-icon lucide lucide-arrow-left"
      >
        <path d="m12 19-7-7 7-7"></path>
        <path d="M19 12H5"></path>
      </svg>
      Back
    </button>

    <div
      data-slot="separator"
      class="bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px"
      id="bits-c1"
      role="separator"
      aria-orientation="vertical"
      data-orientation="vertical"
      data-separator-root=""
    ></div>

    <button
      data-slot="button"
      class="focus-visible:border-ring relative focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 h-7 gap-1.5 rounded-md px-3 has-[&gt;svg]:px-2.5 [&amp;_svg:not([class*='size-'])]:size-3.5 text-xs"
      type="button"
      disabled
    >
      ENTRY NAME FOR DEMO...
    </button>
  </div>
  <div
    id="annotation-header-bar-tools"
    class="flex h-full items-center justify-center gap-1"
  >
    <div
      data-slot="separator"
      class="bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px"
      id="bits-c3"
      role="separator"
      aria-orientation="vertical"
      data-orientation="vertical"
      data-separator-root=""
    ></div>

    <button
      data-slot="button"
      class="focus-visible:border-ring relative focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 size-7 [&amp;_svg:not([class*='size-'])]:size-3.5"
      type="button"
      aria-label="Undo (Ctrl + Z)"
      disabled
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide-icon lucide lucide-undo"
      >
        <path d="M3 7v6h6"></path>
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
      </svg>
    </button>

    <button
      data-slot="button"
      class="focus-visible:border-ring relative focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 size-7 [&amp;_svg:not([class*='size-'])]:size-3.5"
      type="button"
      aria-label="Redo (Ctrl + Shift + Z)"
      disabled
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide-icon lucide lucide-redo"
      >
        <path d="M21 7v6h-6"></path>
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
      </svg>
    </button>
  </div>

  <div
    id="annotation-header-bar-actions"
    class="flex h-full items-center justify-end gap-2"
  >
    <div
      id="annotation-header-bar-actions-menu"
      class="flex items-center gap-1"
    >
      <button
        data-slot="button"
        class="focus-visible:border-ring relative focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 size-7 [&amp;_svg:not([class*='size-'])]:size-3.5"
        type="button"
        aria-label="Settings"
        disabled
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide-icon lucide lucide-settings-2"
        >
          <path d="M14 17H5"></path>
          <path d="M19 7h-9"></path>
          <circle cx="17" cy="17" r="3"></circle>
          <circle cx="7" cy="7" r="3"></circle>
        </svg>
      </button>

      <button
        data-slot="button"
        class="focus-visible:border-ring relative focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 size-7 [&amp;_svg:not([class*='size-'])]:size-3.5"
        type="button"
        aria-label="Comment"
        disabled
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide-icon lucide lucide-message-circle"
        >
          <path
            d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"
          ></path>
        </svg>
      </button>
    </div>

    <button
      data-slot="button"
      class="focus-visible:border-ring relative focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 cursor-pointer bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-7 gap-1.5 rounded-md px-3 has-[&gt;svg]:px-2.5 [&amp;_svg:not([class*='size-'])]:size-3.5 text-xs"
      type="button"
      disabled
    >
      Submit
    </button>
  </div>
</nav>
