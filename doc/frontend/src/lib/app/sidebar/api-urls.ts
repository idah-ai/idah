export async function getApiUrls(baseUrl: URL): Promise<{ url: string; name: string; title?: string; tags?: string[] }[]> {
  const data = await fetch(new URL("/data/swagger.json", baseUrl));

  if (!data.ok) {
    console.error("Failed to load swagger.json");
    return [];
  }

  const result = await data.json();

  return result.urls || [];
}
