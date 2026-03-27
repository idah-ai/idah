export async function getApiUrls(): Promise<
  { url: string; name: string; title?: string; description?: string; tags?: string[] }[]
> {
  try {
    // During build time (SSR), read from filesystem
    if (import.meta.env.SSR) {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const swaggerPath = path.join(process.cwd(), "public", "data", "swagger.json");
        const content = await fs.readFile(swaggerPath, "utf-8");
        const result = JSON.parse(content);
        return result.urls || [];
      } catch (fsError) {
        console.warn("Could not read swagger.json from filesystem during build:", fsError);
        return [];
      }
    }

    // In the browser, use the public file path
    const data = await fetch("/data/swagger.json");

    if (!data.ok) {
      console.error("Failed to load swagger.json");
      return [];
    }

    const result = await data.json();
    return result.urls || [];
  } catch (error) {
    console.error("Error loading API URLs:", error);
    return [];
  }
}
