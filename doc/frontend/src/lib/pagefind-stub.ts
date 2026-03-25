// Stub module for Pagefind in development mode
// Search functionality only works in production build

export async function init() {
  console.warn("Pagefind is not available in development mode. Run 'pnpm build && pnpm preview' to test search.");
}

export async function search(query: string) {
  console.warn("Pagefind search not available in dev mode");
  return { results: [] };
}

export default {
  init,
  search
};
